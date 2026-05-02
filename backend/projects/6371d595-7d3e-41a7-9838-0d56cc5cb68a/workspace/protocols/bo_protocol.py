#!/usr/bin/env python3
"""
ベイズ最適化 逐次探索プロトコル
=====================================
固体電解質組成最適化のための Bayesian Optimization (BO) プロトコル

概要:
  LHS初期設計（20点）から得られたイオン伝導度データを用いて、
  ガウス過程回帰 + Expected Improvement / Thompson Sampling による
  逐次探索を実行し、最適組成を効率的に特定する。

因子空間:
  x1: Li/(Li+Na) モル比 [0.3, 0.9]
  x2: Cl/(Cl+Br+F) アニオン比 [0.2, 0.8]
  x3: 焼結温度 [400, 700] °C
  x4: 焼結時間 [1, 12] h

目的関数:
  maximize log10(σ_ionic) [S/cm] @ 25°C

LHS → BO 移行基準:
  - LHS 20点の測定完了
  - データの分散が十分（CV > 0.3）
  - 少なくとも1点は σ > 1×10⁻⁴ S/cm を達成

逐次探索停止基準:
  - σ > 5×10⁻³ S/cm を3点以上達成
  - 累積50回の実験到達
  - EI値が過去5回連続で閾値以下（収束判定）
"""

import numpy as np
import pandas as pd
from scipy.stats import norm
from scipy.stats.qmc import LatinHypercube
from scipy.optimize import minimize

try:
    import pymc as pm
    import arviz as az
    HAS_PYMC = True
except ImportError:
    HAS_PYMC = False
    print("Warning: PyMC not available. Using scipy-based GP surrogate.")


# ============================================================
# 1. 設定パラメータ
# ============================================================
PARAM_BOUNDS = {
    "Li_Na_ratio": (0.3, 0.9),
    "Anion_Cl_fraction": (0.2, 0.8),
    "Sintering_temp_C": (400.0, 700.0),
    "Sintering_time_h": (1.0, 12.0),
}

# BO ハイパーパラメータ
BO_CONFIG = {
    "n_initial_lhs": 20,
    "n_max_iterations": 30,      # LHS後の逐次探索最大回数
    "n_total_budget": 50,        # 総実験予算
    "target_conductivity": 5e-3, # 目標伝導度 [S/cm]
    "target_hits": 3,            # 目標到達数
    "ei_threshold": 0.01,        # EI収束閾値
    "ei_patience": 5,            # EI連続閾値以下の許容回数
    "exploration_weight": 0.1,   # EI の xi パラメータ
    "thompson_fraction": 0.3,    # Thompson Sampling を使用する割合
    "kernel_length_scale": 1.0,  # RBF カーネル初期長さスケール
    "noise_variance": 0.01,      # 観測ノイズ分散
    "random_seed": 42,
}


# ============================================================
# 2. ガウス過程代理モデル (Surrogate)
# ============================================================
class GaussianProcessSurrogate:
    """
    RBF カーネルによるガウス過程回帰。
    PyMC が利用可能な場合は MCMC でハイパーパラメータを推定、
    そうでない場合は scipy で最適化。
    """
    
    def __init__(self, length_scale=1.0, noise_var=0.01):
        self.length_scale = length_scale
        self.noise_var = noise_var
        self.X_train = None
        self.y_train = None
        self.K_inv = None
        self.alpha = None
    
    def rbf_kernel(self, X1, X2):
        """RBF (Squared Exponential) カーネル"""
        sqdist = np.sum(X1**2, axis=1).reshape(-1, 1) + \
                 np.sum(X2**2, axis=1) - 2 * X1 @ X2.T
        return np.exp(-0.5 * sqdist / self.length_scale**2)
    
    def fit(self, X, y):
        """学習データでモデルをフィット"""
        self.X_train = np.array(X)
        self.y_train = np.array(y).flatten()
        
        K = self.rbf_kernel(self.X_train, self.X_train)
        K += self.noise_var * np.eye(len(K))
        
        self.K_inv = np.linalg.inv(K)
        self.alpha = self.K_inv @ self.y_train
    
    def predict(self, X_new):
        """予測（平均と分散）"""
        X_new = np.array(X_new)
        K_star = self.rbf_kernel(X_new, self.X_train)
        K_star_star = self.rbf_kernel(X_new, X_new)
        
        mu = K_star @ self.alpha
        var = np.diag(K_star_star - K_star @ self.K_inv @ K_star.T)
        var = np.maximum(var, 1e-10)  # 数値安定性
        
        return mu, var
    
    def fit_with_pymc(self, X, y, n_samples=1000):
        """PyMC による MCMC ハイパーパラメータ推定"""
        if not HAS_PYMC:
            self.fit(X, y)
            return
        
        X = np.array(X)
        y = np.array(y).flatten()
        
        with pm.Model() as gp_model:
            # ハイパーパラメータの事前分布
            ls = pm.InverseGamma("length_scale", alpha=5, beta=5)
            eta = pm.HalfCauchy("eta", beta=2)
            sigma = pm.HalfNormal("sigma", sigma=0.1)
            
            # カーネル定義
            cov_func = eta**2 * pm.gp.cov.ExpQuad(input_dim=X.shape[1], ls=ls)
            
            # GP
            gp = pm.gp.Marginal(cov_func=cov_func)
            y_obs = gp.marginal_likelihood("y_obs", X=X, y=y, sigma=sigma)
            
            # サンプリング
            trace = pm.sample(n_samples, return_inferencedata=True, 
                            progressbar=False, random_seed=42)
        
        # 事後分布の中央値でモデル更新
        self.length_scale = float(az.summary(trace)["mean"]["length_scale"])
        self.noise_var = float(az.summary(trace)["mean"]["sigma"])**2
        self.fit(X, y)


# ============================================================
# 3. 獲得関数 (Acquisition Functions)
# ============================================================
def expected_improvement(X_new, gp_model, y_best, xi=0.1):
    """
    Expected Improvement 獲得関数
    
    EI(x) = (mu(x) - f_best - xi) * Φ(Z) + σ(x) * φ(Z)
    Z = (mu(x) - f_best - xi) / σ(x)
    """
    mu, var = gp_model.predict(X_new)
    sigma = np.sqrt(var)
    
    with np.errstate(divide='ignore', invalid='ignore'):
        Z = (mu - y_best - xi) / sigma
        ei = (mu - y_best - xi) * norm.cdf(Z) + sigma * norm.pdf(Z)
        ei[sigma <= 1e-10] = 0.0
    
    return ei


def thompson_sampling(gp_model, X_candidates, n_samples=100):
    """
    Thompson Sampling: GP の事後分布からサンプリングして最大点を選択
    """
    mu, var = gp_model.predict(X_candidates)
    sigma = np.sqrt(var)
    
    # 事後分布からサンプル
    samples = np.random.normal(mu, sigma, size=(n_samples, len(mu)))
    
    # 各サンプルの最大インデックスを集計
    max_indices = np.argmax(samples, axis=1)
    counts = np.bincount(max_indices, minlength=len(mu))
    
    return counts / n_samples  # 選択確率


# ============================================================
# 4. LHS → BO 移行判定
# ============================================================
def check_lhs_to_bo_transition(y_lhs, config=BO_CONFIG):
    """
    LHS初期データからBOへの移行可否を判定
    
    基準:
    1. 全20点の測定が完了していること
    2. データの変動係数(CV) > 0.3
    3. 少なくとも1点が σ > 1×10⁻⁴ S/cm
    
    Returns:
        (bool, str): (移行可否, 理由)
    """
    y = np.array(y_lhs)
    
    if len(y) < config["n_initial_lhs"]:
        return False, f"データ不足: {len(y)}/{config['n_initial_lhs']}点"
    
    cv = np.std(y) / np.abs(np.mean(y)) if np.mean(y) != 0 else 0
    if cv < 0.3:
        return False, f"変動不十分: CV={cv:.3f} < 0.3（追加LHSを推奨）"
    
    max_conductivity = 10**(np.max(y))  # y は log10(σ)
    if max_conductivity < 1e-4:
        return False, f"最大伝導度不足: {max_conductivity:.2e} < 1×10⁻⁴ S/cm"
    
    return True, "移行基準を満たしました。BO逐次探索を開始します。"


# ============================================================
# 5. メインBO探索ループ
# ============================================================
class BayesianOptimizer:
    """
    固体電解質組成最適化のためのベイズ最適化エンジン
    """
    
    def __init__(self, config=BO_CONFIG):
        self.config = config
        self.bounds = list(PARAM_BOUNDS.values())
        self.dim = len(self.bounds)
        self.gp = GaussianProcessSurrogate(
            length_scale=config["kernel_length_scale"],
            noise_variance=config["noise_variance"]
        )
        self.X_observed = []
        self.y_observed = []
        self.ei_history = []
        self.iteration = 0
        
        np.random.seed(config["random_seed"])
    
    def normalize_x(self, X):
        """パラメータを [0, 1] に正規化"""
        X = np.array(X)
        bounds = np.array(self.bounds)
        return (X - bounds[:, 0]) / (bounds[:, 1] - bounds[:, 0])
    
    def denormalize_x(self, X_norm):
        """正規化パラメータを元のスケールに復元"""
        X_norm = np.array(X_norm)
        bounds = np.array(self.bounds)
        return X_norm * (bounds[:, 1] - bounds[:, 0]) + bounds[:, 0]
    
    def generate_initial_lhs(self, n=20):
        """LHS初期実験設計を生成"""
        sampler = LatinHypercube(d=self.dim, seed=self.config["random_seed"])
        X_norm = sampler.random(n=n)
        X_real = self.denormalize_x(X_norm)
        return X_real
    
    def add_observation(self, x, y):
        """観測データを追加（y = log10(conductivity)）"""
        self.X_observed.append(np.array(x))
        self.y_observed.append(y)
    
    def suggest_next(self):
        """
        次の実験点を提案（EI と Thompson Sampling のハイブリッド）
        
        Returns:
            dict: 次の実験条件
        """
        if len(self.X_observed) < 2:
            raise ValueError("最低2点の観測データが必要です")
        
        # GPモデル更新
        X_norm = self.normalize_x(self.X_observed)
        y = np.array(self.y_observed)
        self.gp.fit(X_norm, y)
        
        y_best = np.max(y)
        
        # Thompson Sampling か EI かをランダムに選択
        use_thompson = np.random.random() < self.config["thompson_fraction"]
        
        # 候補点生成（ランダム + 格子点）
        n_candidates = 5000
        X_candidates = np.random.uniform(0, 1, size=(n_candidates, self.dim))
        
        if use_thompson:
            # Thompson Sampling
            probs = thompson_sampling(self.gp, X_candidates)
            best_idx = np.argmax(probs)
        else:
            # Expected Improvement
            ei_values = expected_improvement(
                X_candidates, self.gp, y_best, 
                xi=self.config["exploration_weight"]
            )
            best_idx = np.argmax(ei_values)
            self.ei_history.append(np.max(ei_values))
        
        x_next_norm = X_candidates[best_idx]
        x_next = self.denormalize_x(x_next_norm)
        
        self.iteration += 1
        
        return {
            "run_id": len(self.X_observed) + 1,
            "Li_Na_ratio": round(float(x_next[0]), 4),
            "Anion_Cl_fraction": round(float(x_next[1]), 4),
            "Sintering_temp_C": round(float(x_next[2]), 1),
            "Sintering_time_h": round(float(x_next[3]), 2),
            "acquisition": "Thompson" if use_thompson else "EI",
            "predicted_log_sigma": round(float(self.gp.predict(x_next_norm.reshape(1, -1))[0][0]), 4),
        }
    
    def check_stopping_criteria(self):
        """
        停止基準チェック
        
        Returns:
            (bool, str): (停止すべきか, 理由)
        """
        y = np.array(self.y_observed)
        
        # 基準1: 目標到達数
        n_hits = np.sum(10**y >= self.config["target_conductivity"])
        if n_hits >= self.config["target_hits"]:
            return True, f"目標達成: {n_hits}点が σ>{self.config['target_conductivity']:.0e} S/cm を超過"
        
        # 基準2: 総予算
        if len(y) >= self.config["n_total_budget"]:
            return True, f"予算到達: {len(y)}/{self.config['n_total_budget']}点実行済み"
        
        # 基準3: EI収束
        if len(self.ei_history) >= self.config["ei_patience"]:
            recent_ei = self.ei_history[-self.config["ei_patience"]:]
            if all(ei < self.config["ei_threshold"] for ei in recent_ei):
                return True, f"EI収束: 直近{self.config['ei_patience']}回が閾値以下"
        
        return False, "継続"
    
    def get_current_best(self):
        """現在の最良結果を返す"""
        if not self.y_observed:
            return None
        
        best_idx = np.argmax(self.y_observed)
        return {
            "x": self.X_observed[best_idx].tolist(),
            "log_sigma": self.y_observed[best_idx],
            "sigma_Scm": 10**self.y_observed[best_idx],
            "params": {
                "Li_Na_ratio": self.X_observed[best_idx][0],
                "Anion_Cl_fraction": self.X_observed[best_idx][1],
                "Sintering_temp_C": self.X_observed[best_idx][2],
                "Sintering_time_h": self.X_observed[best_idx][3],
            }
        }


# ============================================================
# 6. プロトコル実行例
# ============================================================
def run_protocol_demo():
    """
    プロトコル実行のデモンストレーション
    （模擬データを使用）
    """
    print("=" * 60)
    print("固体電解質BO逐次探索プロトコル - デモ実行")
    print("=" * 60)
    
    optimizer = BayesianOptimizer()
    
    # Phase 1: LHS 初期設計
    print("\n[Phase 1] LHS初期実験設計")
    X_lhs = optimizer.generate_initial_lhs(n=20)
    print(f"  生成点数: {len(X_lhs)}")
    print(f"  因子範囲:")
    for name, (lo, hi) in PARAM_BOUNDS.items():
        print(f"    {name}: [{lo}, {hi}]")
    
    # 模擬測定データ（実際は実験で取得）
    np.random.seed(42)
    def mock_objective(x):
        """模擬目的関数: 組成空間における伝導度の仮想モデル"""
        li_na = x[0]
        cl_frac = x[1]
        temp = x[2]
        time = x[3]
        # Li/Na比0.7付近、Cl比0.5付近、550°C、6h付近で最大
        base = -3.0 + 1.5 * np.exp(-((li_na-0.7)**2/0.1 + (cl_frac-0.5)**2/0.1))
        temp_effect = -0.5 * ((temp-550)/100)**2
        time_effect = -0.2 * ((time-6)/4)**2
        noise = np.random.normal(0, 0.1)
        return base + temp_effect + time_effect + noise
    
    # LHS データ取得
    y_lhs = [mock_objective(x) for x in X_lhs]
    for x, y in zip(X_lhs, y_lhs):
        optimizer.add_observation(x, y)
    
    print(f"\n  初期データ統計:")
    print(f"    最大 log10(σ): {max(y_lhs):.3f} → σ = {10**max(y_lhs):.2e} S/cm")
    print(f"    平均 log10(σ): {np.mean(y_lhs):.3f}")
    print(f"    標準偏差: {np.std(y_lhs):.3f}")
    
    # Phase 2: 移行判定
    print("\n[Phase 2] LHS→BO移行判定")
    can_transition, reason = check_lhs_to_bo_transition(y_lhs)
    print(f"  判定: {'✓ 移行可' if can_transition else '✗ 移行不可'}")
    print(f"  理由: {reason}")
    
    if not can_transition:
        print("  → 追加LHS点を実施してから再判定してください")
        return
    
    # Phase 3: BO 逐次探索
    print("\n[Phase 3] ベイズ最適化 逐次探索")
    for i in range(10):  # デモでは10回
        suggestion = optimizer.suggest_next()
        
        # 模擬測定
        x_new = [suggestion["Li_Na_ratio"], suggestion["Anion_Cl_fraction"],
                 suggestion["Sintering_temp_C"], suggestion["Sintering_time_h"]]
        y_new = mock_objective(x_new)
        optimizer.add_observation(x_new, y_new)
        
        print(f"  Iter {i+1}: σ={10**y_new:.2e} S/cm | "
              f"Acq={suggestion['acquisition']} | "
              f"Li/Na={suggestion['Li_Na_ratio']:.3f} | "
              f"Cl={suggestion['Anion_Cl_fraction']:.3f} | "
              f"T={suggestion['Sintering_temp_C']:.0f}°C | "
              f"t={suggestion['Sintering_time_h']:.1f}h")
        
        # 停止判定
        stop, stop_reason = optimizer.check_stopping_criteria()
        if stop:
            print(f"\n  ⚡ 停止: {stop_reason}")
            break
    
    # 最終結果
    best = optimizer.get_current_best()
    print(f"\n[結果] 最良組成:")
    print(f"  σ = {best['sigma_Scm']:.2e} S/cm")
    print(f"  Li/(Li+Na) = {best['params']['Li_Na_ratio']:.4f}")
    print(f"  Cl fraction = {best['params']['Anion_Cl_fraction']:.4f}")
    print(f"  焼結温度 = {best['params']['Sintering_temp_C']:.1f} °C")
    print(f"  焼結時間 = {best['params']['Sintering_time_h']:.2f} h")
    print(f"\n  総実験数: {len(optimizer.y_observed)}")
    
    return optimizer


if __name__ == "__main__":
    optimizer = run_protocol_demo()
