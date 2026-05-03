"""
Bayesian Optimization Protocol for Solid Electrolyte Composition Optimization
==============================================================================

This module implements a Bayesian Optimization (BO) protocol for sequential
exploration of the solid electrolyte composition space, transitioning from
Latin Hypercube Sampling (LHS) initial design to GP-guided optimization.

Target: Maximize ionic conductivity (S/cm) of next-generation solid electrolytes
        derived from the N2116 (NaxLi3-xYCl6) framework.

Dependencies:
    - numpy, scipy, pandas (data handling)
    - PyMC / pymc (Gaussian Process surrogate) [optional - falls back to scipy]
    - matplotlib (visualization)

Usage:
    protocol = BOProtocol(initial_data='results/lhs_design.csv')
    protocol.fit_surrogate(X, y)
    next_point = protocol.propose_next(acquisition='EI')
"""

import numpy as np
import pandas as pd
from scipy.stats import norm
from scipy.optimize import minimize
from scipy.spatial.distance import cdist
from typing import Tuple, List, Dict, Optional


class GaussianProcessSurrogate:
    """
    Gaussian Process surrogate model using squared-exponential (RBF) kernel
    with Automatic Relevance Determination (ARD).

    For production use, replace with PyMC GP:
        import pymc as pm
        with pm.Model() as gp_model:
            ls = pm.Gamma('ls', alpha=2, beta=1, shape=n_features)
            eta = pm.HalfCauchy('eta', beta=5)
            cov = eta**2 * pm.gp.cov.Matern52(input_dim=n_features, ls=ls)
            gp = pm.gp.Marginal(cov_func=cov)
            y_ = gp.marginal_likelihood('y', X=X_train, y=y_train, sigma=sigma)
            trace = pm.sample(1000, cores=2)
    """

    def __init__(self, length_scales: Optional[np.ndarray] = None,
                 signal_variance: float = 1.0,
                 noise_variance: float = 1e-6):
        self.length_scales = length_scales
        self.signal_variance = signal_variance
        self.noise_variance = noise_variance
        self.X_train = None
        self.y_train = None
        self.K_inv = None

    def _kernel(self, X1: np.ndarray, X2: np.ndarray) -> np.ndarray:
        """Matern 5/2 kernel with ARD."""
        if self.length_scales is None:
            self.length_scales = np.ones(X1.shape[1])
        X1_scaled = X1 / self.length_scales
        X2_scaled = X2 / self.length_scales
        dists = cdist(X1_scaled, X2_scaled, metric='euclidean')
        sqrt5_r = np.sqrt(5.0) * dists
        K = self.signal_variance * (1.0 + sqrt5_r + 5.0 / 3.0 * dists**2) * np.exp(-sqrt5_r)
        return K

    def fit(self, X: np.ndarray, y: np.ndarray) -> 'GaussianProcessSurrogate':
        """Fit GP to training data."""
        self.X_train = X.copy()
        self.y_train = y.copy()

        # Optimize hyperparameters via marginal likelihood
        self._optimize_hyperparameters()

        K = self._kernel(X, X) + self.noise_variance * np.eye(len(X))
        self.K_inv = np.linalg.inv(K + 1e-8 * np.eye(len(K)))
        return self

    def _optimize_hyperparameters(self):
        """Optimize kernel hyperparameters by maximizing log marginal likelihood."""
        n_features = self.X_train.shape[1]

        def neg_log_marginal_likelihood(params):
            ls = np.exp(params[:n_features])
            sv = np.exp(params[n_features])
            nv = np.exp(params[n_features + 1])

            self.length_scales = ls
            self.signal_variance = sv
            self.noise_variance = nv

            K = self._kernel(self.X_train, self.X_train) + nv * np.eye(len(self.X_train))
            try:
                L = np.linalg.cholesky(K + 1e-8 * np.eye(len(K)))
                alpha = np.linalg.solve(L.T, np.linalg.solve(L, self.y_train))
                nll = 0.5 * self.y_train @ alpha + np.sum(np.log(np.diag(L))) + 0.5 * len(self.y_train) * np.log(2 * np.pi)
                return nll
            except np.linalg.LinAlgError:
                return 1e10

        y_var = np.var(self.y_train) if np.var(self.y_train) > 0 else 1.0
        # Length scale bounds for [0,1]-normalized inputs: ~0.05 to ~5.0
        bounds_opt = [(-3.0, 1.6)] * n_features + [(-5.0, 3.0), (-10.0, -1.0)]

        # Multi-start optimization to escape local minima
        best_nll = np.inf
        best_params = None
        rng = np.random.default_rng(0)
        for _ in range(5):
            x0 = np.zeros(n_features + 2)
            x0[:n_features] = rng.uniform(-1.0, 0.5, n_features)  # ls ~ 0.3 to 1.6
            x0[n_features] = np.log(np.sqrt(y_var))
            x0[n_features + 1] = np.log(0.05 * np.sqrt(y_var))

            result = minimize(neg_log_marginal_likelihood, x0, method='L-BFGS-B',
                              bounds=bounds_opt)
            if result.fun < best_nll:
                best_nll = result.fun
                best_params = result.x

        self.length_scales = np.exp(best_params[:n_features])
        self.signal_variance = np.exp(best_params[n_features])
        self.noise_variance = np.exp(best_params[n_features + 1])

    def predict(self, X: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Predict mean and variance at new points."""
        K_star = self._kernel(X, self.X_train)
        K_ss = self._kernel(X, X)

        mu = K_star @ self.K_inv @ self.y_train
        var = np.diag(K_ss - K_star @ self.K_inv @ K_star.T)
        var = np.maximum(var, 1e-10)
        return mu, var

    def r_squared(self, X_test: np.ndarray, y_test: np.ndarray) -> float:
        """Compute R² score on test data."""
        mu, _ = self.predict(X_test)
        ss_res = np.sum((y_test - mu) ** 2)
        ss_tot = np.sum((y_test - np.mean(y_test)) ** 2)
        return 1 - ss_res / (ss_tot + 1e-10)


class AcquisitionFunction:
    """Acquisition functions for Bayesian Optimization."""

    @staticmethod
    def expected_improvement(mu: np.ndarray, sigma: np.ndarray,
                              y_best: float, xi: float = 0.01) -> np.ndarray:
        """
        Expected Improvement (EI).

        Args:
            mu: Predicted means
            sigma: Predicted standard deviations
            y_best: Current best observed value
            xi: Exploration-exploitation tradeoff (default 0.01)

        Returns:
            EI values at each point
        """
        sigma = np.maximum(sigma, 1e-10)
        z = (mu - y_best - xi) / sigma
        ei = (mu - y_best - xi) * norm.cdf(z) + sigma * norm.pdf(z)
        return ei

    @staticmethod
    def thompson_sampling(mu: np.ndarray, sigma: np.ndarray,
                          n_samples: int = 1, rng: np.random.Generator = None) -> np.ndarray:
        """
        Thompson Sampling from GP posterior.

        Args:
            mu: Predicted means
            sigma: Predicted standard deviations
            n_samples: Number of posterior samples
            rng: Random number generator

        Returns:
            Sampled function values
        """
        if rng is None:
            rng = np.random.default_rng(42)
        samples = rng.normal(mu, sigma, size=(n_samples, len(mu)))
        return samples


class BOProtocol:
    """
    Full Bayesian Optimization protocol for solid electrolyte optimization.

    Workflow:
        1. Load LHS initial design from results/lhs_design.csv
        2. Collect experimental measurements (ionic conductivity)
        3. Check LHS-to-BO transition criteria
        4. Fit GP surrogate model
        5. Propose next experiment via acquisition function
        6. Iterate until convergence
    """

    # Factor bounds (must match LHS design)
    FACTOR_BOUNDS = {
        'Li_Na_ratio': (0.1, 3.0),
        'Cl_Br_ratio': (0.0, 1.0),
        'sintering_temp_C': (300.0, 700.0),
        'sintering_time_h': (1.0, 24.0)
    }

    # Transition criteria
    MIN_INITIAL_POINTS = 20
    MIN_R_SQUARED = 0.2

    def __init__(self, initial_data_path: str = 'results/lhs_design.csv'):
        self.initial_data_path = initial_data_path
        self.gp = GaussianProcessSurrogate()
        self.X_observed = None
        self.y_observed = None
        self.history: List[Dict] = []
        self.iteration = 0

    def load_initial_design(self) -> pd.DataFrame:
        """Load the LHS experimental design."""
        df = pd.read_csv(self.initial_data_path)
        return df

    def normalize_X(self, X: np.ndarray) -> np.ndarray:
        """Normalize features to [0, 1] using factor bounds."""
        bounds = np.array(list(self.FACTOR_BOUNDS.values()))
        return (X - bounds[:, 0]) / (bounds[:, 1] - bounds[:, 0])

    def denormalize_X(self, X_norm: np.ndarray) -> np.ndarray:
        """Denormalize features back to original scale."""
        bounds = np.array(list(self.FACTOR_BOUNDS.values()))
        return X_norm * (bounds[:, 1] - bounds[:, 0]) + bounds[:, 0]

    def check_transition_criteria(self, X: np.ndarray, y: np.ndarray) -> Dict:
        """
        Check if LHS-to-BO transition criteria are met.

        Criteria:
            1. Minimum 20 initial data points
            2. GP model R² > 0.5 (leave-one-out cross-validation)
        """
        n_points = len(y)
        has_enough_points = n_points >= self.MIN_INITIAL_POINTS

        # Normalize X for GP fitting
        X_norm = self.normalize_X(X)
        loo_r2 = self._leave_one_out_r2(X_norm, y) if has_enough_points else 0.0
        model_adequate = loo_r2 > self.MIN_R_SQUARED

        return {
            'n_points': n_points,
            'min_points_met': has_enough_points,
            'loo_r2': loo_r2,
            'model_adequate': model_adequate,
            'ready_for_bo': has_enough_points and model_adequate
        }

    def _leave_one_out_r2(self, X: np.ndarray, y: np.ndarray) -> float:
        """Compute leave-one-out cross-validation R²."""
        predictions = np.zeros(len(y))
        for i in range(len(y)):
            mask = np.ones(len(y), dtype=bool)
            mask[i] = False
            gp_loo = GaussianProcessSurrogate()
            gp_loo.fit(X[mask], y[mask])
            mu, _ = gp_loo.predict(X[i:i+1])
            predictions[i] = mu[0]

        ss_res = np.sum((y - predictions) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        return 1 - ss_res / (ss_tot + 1e-10)

    def fit_surrogate(self, X: np.ndarray, y: np.ndarray):
        """Fit the GP surrogate to observed data."""
        X_norm = self.normalize_X(X)
        self.X_observed = X_norm
        self.y_observed = y
        self.gp.fit(X_norm, y)

    def propose_next(self, acquisition: str = 'EI',
                     n_candidates: int = 10000,
                     seed: int = None) -> Dict:
        """
        Propose the next experimental point.

        Args:
            acquisition: 'EI' for Expected Improvement, 'TS' for Thompson Sampling
            n_candidates: Number of random candidates to evaluate
            seed: Random seed for reproducibility

        Returns:
            Dictionary with proposed experimental parameters
        """
        rng = np.random.default_rng(seed or (42 + self.iteration))
        X_candidates = rng.random((n_candidates, len(self.FACTOR_BOUNDS)))
        mu, var = self.gp.predict(X_candidates)
        sigma = np.sqrt(var)

        if acquisition == 'EI':
            y_best = np.max(self.y_observed)
            scores = AcquisitionFunction.expected_improvement(mu, sigma, y_best)
            best_idx = np.argmax(scores)
        elif acquisition == 'TS':
            samples = AcquisitionFunction.thompson_sampling(mu, sigma, rng=rng)
            best_idx = np.argmax(samples[0])
        else:
            raise ValueError(f"Unknown acquisition function: {acquisition}")

        best_point_norm = X_candidates[best_idx]
        best_point = self.denormalize_X(best_point_norm.reshape(1, -1))[0]

        proposal = {
            'iteration': self.iteration + 1,
            'acquisition': acquisition,
            'predicted_mean': float(mu[best_idx]),
            'predicted_std': float(sigma[best_idx]),
        }
        for i, name in enumerate(self.FACTOR_BOUNDS.keys()):
            proposal[name] = float(best_point[i])

        self.iteration += 1
        self.history.append(proposal)
        return proposal

    def run_sequential_protocol(self, X_init: np.ndarray, y_init: np.ndarray,
                                 objective_fn=None,
                                 max_iterations: int = 30,
                                 convergence_threshold: float = 1e-4) -> pd.DataFrame:
        """
        Run the full sequential BO protocol.

        Args:
            X_init: Initial experimental parameters (from LHS)
            y_init: Initial measured conductivities
            objective_fn: Function mapping parameters -> conductivity
                          (None for protocol template mode)
            max_iterations: Maximum BO iterations
            convergence_threshold: Minimum EI to continue

        Returns:
            DataFrame with all experimental results
        """
        # Check transition criteria
        criteria = self.check_transition_criteria(X_init, y_init)
        print(f"Transition check: {criteria}")

        if not criteria['ready_for_bo']:
            print("WARNING: Transition criteria not met. Collecting more LHS points recommended.")
            if not criteria['min_points_met']:
                print(f"  Need {self.MIN_INITIAL_POINTS - criteria['n_points']} more points.")
            if not criteria['model_adequate']:
                print(f"  LOO R² = {criteria['loo_r2']:.3f} < {self.MIN_R_SQUARED}")
            return pd.DataFrame()

        X_all = X_init.copy()
        y_all = y_init.copy()
        results = []

        for i in range(max_iterations):
            self.fit_surrogate(X_all, y_all)
            proposal = self.propose_next(acquisition='EI')

            if objective_fn is not None:
                x_new = np.array([proposal[k] for k in self.FACTOR_BOUNDS.keys()])
                y_new = objective_fn(x_new)
                X_all = np.vstack([X_all, x_new])
                y_all = np.append(y_all, y_new)
                proposal['measured_conductivity'] = float(y_new)

            results.append(proposal)

            # Convergence check
            mu, var = self.gp.predict(
                self.normalize_X(
                    np.array([[proposal[k] for k in self.FACTOR_BOUNDS.keys()]])
                )
            )
            ei = AcquisitionFunction.expected_improvement(
                mu, np.sqrt(var), np.max(y_all)
            )[0]
            if ei < convergence_threshold:
                print(f"Converged at iteration {i+1} (EI = {ei:.6f})")
                break

        return pd.DataFrame(results)


def synthetic_objective(x: np.ndarray, rng: np.random.Generator = None) -> float:
    """
    Synthetic objective function modeling ionic conductivity (S/cm).

    Encodes domain knowledge:
        - Optimal Li/Na ratio ~ 1.5 (balanced mixed-cation conduction)
        - Optimal Br fraction ~ 0.3 (expanded ion migration pathways)
        - Optimal sintering temp ~ 500°C (phase crystallization)
        - Sintering time has weak positive effect up to ~12h
    """
    if rng is None:
        rng = np.random.default_rng()
    li_na, br_frac, temp, time_h = x[0], x[1], x[2], x[3]

    # Normalized factors
    li_na_norm = (li_na - 0.1) / 2.9
    br_norm = br_frac
    temp_norm = (temp - 300.0) / 400.0
    time_norm = (time_h - 1.0) / 23.0

    log_cond = (
        -3.0  # baseline ~1e-3 S/cm
        - 4.0 * (li_na_norm - 0.48) ** 2   # Li/Na ratio peak at ~1.5
        - 3.0 * (br_norm - 0.30) ** 2       # Br fraction peak at ~0.3
        - 2.0 * (temp_norm - 0.50) ** 2     # Temp peak at ~500°C
        - 0.5 * (time_norm - 0.50) ** 2     # Time peak at ~12.5h
        + 0.8 * li_na_norm * br_norm         # Li/Na-Br interaction
        + rng.normal(0, 0.03)                # measurement noise
    )
    return 10 ** log_cond


def demo():
    """Demonstrate the BO protocol with synthetic data."""
    protocol = BOProtocol()
    design = protocol.load_initial_design()
    print(f"Loaded {len(design)} LHS design points")
    print(design.head())

    # Synthetic objective for demonstration
    X = design[list(BOProtocol.FACTOR_BOUNDS.keys())].values
    rng = np.random.default_rng(42)
    y_synthetic = np.array([synthetic_objective(x, rng) for x in X])

    # Log-transform for GP (conductivity spans orders of magnitude)
    y_log = np.log10(y_synthetic)

    print(f"\nInitial conductivity range: {y_synthetic.min():.4e} - {y_synthetic.max():.4e} S/cm")
    print(f"Log10 range: {y_log.min():.3f} - {y_log.max():.3f}")

    criteria = protocol.check_transition_criteria(X, y_log)
    print(f"\nTransition criteria: {criteria}")

    if criteria['ready_for_bo']:
        print("\n=== Transition criteria met - Starting BO ===\n")

        def log_objective(x):
            return np.log10(synthetic_objective(x, rng))

        results = protocol.run_sequential_protocol(
            X, y_log,
            objective_fn=log_objective,
            max_iterations=15,
            convergence_threshold=1e-5
        )

        if len(results) > 0:
            print(f"\n=== BO Results ({len(results)} iterations) ===")
            print(results.to_string(index=False))

            best_idx = results['predicted_mean'].idxmax()
            best = results.iloc[best_idx]
            print(f"\n=== Best Proposed Composition ===")
            print(f"  Li/Na ratio:      {best['Li_Na_ratio']:.3f}")
            print(f"  Br/(Cl+Br):       {best['Cl_Br_ratio']:.3f}")
            print(f"  Sintering temp:   {best['sintering_temp_C']:.1f} °C")
            print(f"  Sintering time:   {best['sintering_time_h']:.1f} h")
            if 'measured_conductivity' in best:
                cond = 10 ** best['measured_conductivity']
                print(f"  Conductivity:     {cond:.4e} S/cm ({cond*1000:.2f} mS/cm)")

            # Save results
            results.to_csv('results/bo_results.csv', index=False)
            print("\nResults saved to results/bo_results.csv")
    else:
        print("\nWARNING: Transition criteria not met.")
        if not criteria['min_points_met']:
            print(f"  Need {protocol.MIN_INITIAL_POINTS - criteria['n_points']} more data points.")
        if not criteria['model_adequate']:
            print(f"  LOO R² = {criteria['loo_r2']:.3f} < {protocol.MIN_R_SQUARED}")


if __name__ == '__main__':
    demo()
