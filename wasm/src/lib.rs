use pulldown_cmark::{html, Event, Options, Parser, Tag, TagEnd};
use ammonia::Builder;
use std::collections::HashSet;
use wasm_bindgen::prelude::*;

/// URI schemes that are blocked in links
const BLOCKED_SCHEMES: &[&str] = &["javascript:", "vbscript:", "data:text/html"];

/// Render markdown to sanitized HTML.
/// Uses pulldown-cmark for parsing and ammonia for sanitization.
#[wasm_bindgen]
pub fn render_markdown(input: &str) -> String {
    let options = Options::ENABLE_TABLES
        | Options::ENABLE_STRIKETHROUGH
        | Options::ENABLE_TASKLISTS;

    let parser = Parser::new_ext(input, options);

    // Filter out dangerous links and handle mermaid code blocks
    let mut in_mermaid = false;
    let mut mermaid_content = String::new();

    let events: Vec<Event> = parser.collect();
    let mut filtered_events: Vec<Event> = Vec::new();
    let mut output_parts: Vec<String> = Vec::new();
    let mut i = 0;

    while i < events.len() {
        match &events[i] {
            Event::Start(Tag::CodeBlock(pulldown_cmark::CodeBlockKind::Fenced(lang)))
                if lang.as_ref() == "mermaid" =>
            {
                in_mermaid = true;
                mermaid_content.clear();
                i += 1;
                continue;
            }
            Event::End(TagEnd::CodeBlock) if in_mermaid => {
                in_mermaid = false;
                // Flush any pending filtered events as HTML first
                if !filtered_events.is_empty() {
                    let mut html_output = String::new();
                    html::push_html(&mut html_output, filtered_events.drain(..));
                    output_parts.push(html_output);
                }
                // Insert mermaid block with special class
                let escaped = html_escape(&mermaid_content);
                output_parts.push(format!(
                    "<pre class=\"mermaid\">{}</pre>",
                    escaped
                ));
                i += 1;
                continue;
            }
            Event::Text(text) if in_mermaid => {
                mermaid_content.push_str(text.as_ref());
                i += 1;
                continue;
            }
            Event::Start(Tag::Link { dest_url, .. }) => {
                if is_blocked_uri(dest_url.as_ref()) {
                    // Skip the entire link, keep text only
                    i += 1;
                    while i < events.len() {
                        if matches!(&events[i], Event::End(TagEnd::Link)) {
                            i += 1;
                            break;
                        }
                        // Keep text content
                        if let Event::Text(t) = &events[i] {
                            filtered_events.push(Event::Text(t.clone()));
                        }
                        i += 1;
                    }
                    continue;
                }
            }
            Event::Start(Tag::Image { dest_url, .. }) => {
                if is_blocked_uri(dest_url.as_ref()) {
                    // Skip blocked image
                    i += 1;
                    while i < events.len() {
                        if matches!(&events[i], Event::End(TagEnd::Image)) {
                            i += 1;
                            break;
                        }
                        i += 1;
                    }
                    continue;
                }
            }
            _ => {}
        }

        filtered_events.push(events[i].clone());
        i += 1;
    }

    // Flush remaining events
    if !filtered_events.is_empty() {
        let mut html_output = String::new();
        html::push_html(&mut html_output, filtered_events.into_iter());
        output_parts.push(html_output);
    }

    let raw_html = output_parts.join("");

    // Sanitize with ammonia
    sanitize_html(&raw_html)
}

/// Check if a URI scheme is blocked.
#[wasm_bindgen]
pub fn is_blocked_uri(uri: &str) -> bool {
    let lower = uri.trim().to_lowercase();
    BLOCKED_SCHEMES.iter().any(|scheme| lower.starts_with(scheme))
}

fn sanitize_html(html: &str) -> String {
    let mut allowed_tags = HashSet::new();
    for tag in &[
        "h1", "h2", "h3", "h4", "h5", "h6",
        "p", "br", "hr",
        "ul", "ol", "li",
        "blockquote", "pre", "code",
        "strong", "em", "del", "s",
        "a", "img",
        "table", "thead", "tbody", "tr", "th", "td",
        "div", "span", "input",
    ] {
        allowed_tags.insert(*tag);
    }

    let mut allowed_attrs = std::collections::HashMap::new();
    allowed_attrs.insert("a", vec!["href", "title", "target", "class"].into_iter().collect::<HashSet<&str>>());
    allowed_attrs.insert("img", vec!["src", "alt", "title", "class"].into_iter().collect());
    allowed_attrs.insert("pre", vec!["class"].into_iter().collect());
    allowed_attrs.insert("code", vec!["class"].into_iter().collect());
    allowed_attrs.insert("div", vec!["class"].into_iter().collect());
    allowed_attrs.insert("span", vec!["class"].into_iter().collect());
    allowed_attrs.insert("input", vec!["type", "checked", "disabled"].into_iter().collect());

    Builder::new()
        .tags(allowed_tags)
        .tag_attributes(allowed_attrs)
        .link_rel(Some("noopener noreferrer"))
        .strip_comments(true)
        .clean(html)
        .to_string()
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#039;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bold() {
        let html = render_markdown("**hello**");
        assert!(html.contains("<strong>hello</strong>"));
    }

    #[test]
    fn test_code_block() {
        let html = render_markdown("```rust\nfn main() {}\n```");
        assert!(html.contains("<pre"));
        assert!(html.contains("fn main()"));
    }

    #[test]
    fn test_mermaid_block() {
        let html = render_markdown("```mermaid\ngraph TD\nA-->B\n```");
        assert!(html.contains("class=\"mermaid\""));
        assert!(html.contains("graph TD"));
    }

    #[test]
    fn test_blocks_javascript_uri() {
        let html = render_markdown("[click](javascript:alert(1))");
        assert!(!html.contains("javascript:"));
        assert!(html.contains("click"));
    }

    #[test]
    fn test_blocks_vbscript_uri() {
        let html = render_markdown("[x](vbscript:exec)");
        assert!(!html.contains("vbscript:"));
    }

    #[test]
    fn test_strips_script_tag() {
        let html = render_markdown("<script>alert(1)</script>");
        assert!(!html.contains("<script"));
    }

    #[test]
    fn test_strips_iframe() {
        let html = render_markdown("<iframe src='evil.com'></iframe>");
        assert!(!html.contains("<iframe"));
    }

    #[test]
    fn test_table() {
        let html = render_markdown("| A | B |\n|---|---|\n| 1 | 2 |");
        assert!(html.contains("<table"));
    }

    #[test]
    fn test_is_blocked_uri() {
        assert!(is_blocked_uri("javascript:alert(1)"));
        assert!(is_blocked_uri("JAVASCRIPT:void(0)"));
        assert!(is_blocked_uri("data:text/html,<h1>"));
        assert!(!is_blocked_uri("https://example.com"));
        assert!(!is_blocked_uri("data:image/png;base64,abc"));
    }
}
