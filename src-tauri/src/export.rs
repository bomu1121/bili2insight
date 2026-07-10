use crate::{VideoInfo, InsightResult};

fn format_duration(seconds: i64) -> String {
    let h = seconds / 3600;
    let m = (seconds % 3600) / 60;
    let s = seconds % 60;
    if h > 0 {
        format!("{:02}:{:02}:{:02}", h, m, s)
    } else {
        format!("{:02}:{:02}", m, s)
    }
}

fn format_timestamp(ts: i64) -> String {
    use chrono::{DateTime, Local};
    if let Some(dt) = DateTime::from_timestamp(ts, 0) {
        let local = dt.with_timezone(&Local);
        local.format("%Y-%m-%d %H:%M").to_string()
    } else {
        ts.to_string()
    }
}

pub fn generate_markdown(
    info: &VideoInfo,
    transcript: &str,
    insights: &InsightResult,
) -> String {
    let mut md = String::new();

    // Title
    md.push_str(&format!("# {}\n\n", info.title));

    // Video meta
    md.push_str("## Video Info\n\n");
    md.push_str(&format!("- **BV**: `{}`\n", info.bvid));
    md.push_str(&format!("- **Uploader**: [{}](https://space.bilibili.com/{})\n", info.uploader, info.uploader_uid));
    md.push_str(&format!("- **Duration**: {}\n", format_duration(info.duration)));
    md.push_str(&format!("- **Published**: {}\n", format_timestamp(info.pubdate)));
    if !info.description.is_empty() {
        md.push_str(&format!("- **Description**: {}\n", truncate_desc(&info.description, 200)));
    }
    md.push('\n');

    // AI Insights
    md.push_str("## AI Insights\n\n");
    if !insights.summary.is_empty() {
        md.push_str(&format!("### Summary\n\n{}\n\n", insights.summary));
    }
    if !insights.key_points.is_empty() {
        md.push_str("### Key Points\n\n");
        for (i, pt) in insights.key_points.iter().enumerate() {
            md.push_str(&format!("{}. {}\n", i + 1, pt));
        }
        md.push('\n');
    }
    if !insights.tags.is_empty() {
        md.push_str("### Tags\n\n");
        for tag in &insights.tags {
            md.push_str(&format!("`{}` ", tag));
        }
        md.push_str("\n\n");
    }

    // Full transcript
    md.push_str("---\n\n");
    md.push_str("## Full Transcript\n\n");
    md.push_str(transcript);
    md.push('\n');

    md
}

fn truncate_desc(desc: &str, max_len: usize) -> String {
    let chars: Vec<char> = desc.chars().collect();
    if chars.len() <= max_len {
        desc.to_string()
    } else {
        let truncated: String = chars.iter().take(max_len).collect();
        format!("{}...", truncated)
    }
}
