#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
# Copyright (C) 2026 Abhishek Sengar

import html
import json
import re
import shutil
import subprocess
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SITE_SOURCE = REPO_ROOT / "site-src"
PAGES_SOURCE = SITE_SOURCE / "pages"
PARTIALS_SOURCE = SITE_SOURCE / "partials"
STATIC_SOURCE = SITE_SOURCE / "static"
OFFICIAL_LINKS_SOURCE = SITE_SOURCE / "official-links.json"
LIBRARY_SOURCE = REPO_ROOT / "src" / "wgpu3d"
OUTPUT_DIRECTORY = REPO_ROOT
PAGES_DIRECTORY_NAME = "site"
PAGES_DIRECTORY = OUTPUT_DIRECTORY / PAGES_DIRECTORY_NAME
ROOT_PAGES = {"index.html", "404.html"}

SITE_URL = "https://gpuengine.github.io"
REPOSITORY_URL = "https://github.com/gpuengine/gpuengine.github.io"
LIBRARY_NAME = "wgpu3d"
LICENSE_IDENTIFIER = "GPL-2.0-or-later"
COPYRIGHT_NOTICE = "Copyright (C) 2026 Abhishek Sengar"

ESBUILD_VERSION = "0.28.2"
ESBUILD_TARGET = "es2022"
ALREADY_MINIFIED_SUFFIX = ".min.js"
SITEMAP_EXCLUDED_PREFIXES = (f"/{PAGES_DIRECTORY_NAME}/tutorials/examples/", f"/{PAGES_DIRECTORY_NAME}/tutorials/playground/")
SITEMAP_PRIORITY_BY_DEPTH = {0: "1.0", 1: "0.9", 2: "0.8"}
DEFAULT_SITEMAP_PRIORITY = "0.7"
OPTIONAL_ASSETS = {f"/{PAGES_DIRECTORY_NAME}/media/author.jpg"}
OFFICIAL_LINKS_TOKEN = "{{official-links}}"
OFFICIAL_RESOURCES_TOKEN = "{{official-resources}}"
OFFICIAL_LINKS_HEADING = "Official documentation"

INCLUDE_PATTERN = re.compile(r"\{\{include ([\w.-]+)\}\}")
LIBRARY_TOKEN_PATTERN = re.compile(r"\{\{([\w]+)-(file|version)\}\}")
LIBRARY_VERSION_PATTERN = re.compile(r'export const VERSION = "([^"]+)"')
ANCHOR_PATTERN = re.compile(r'<a ([^>]*?)href="([^"]+)"([^>]*)>')
INTERNAL_REFERENCE_PATTERN = re.compile(r'(?:href|src|poster)="(/(?!/)[^"#?]*)')
IMPORT_MAP_PATTERN = re.compile(r'<script type="importmap">(.*?)</script>', re.S)
IMPORT_MAP_TARGET_PATTERN = re.compile(r'"[\w@/.-]+"\s*:\s*"(/(?!/)[^"]+)"')
NOINDEX_PATTERN = re.compile(r'<meta name="robots" content="[^"]*noindex')
TITLE_PATTERN = re.compile(r"<title>(.*?)</title>", re.S)
DESCRIPTION_PATTERN = re.compile(r'<meta name="description" content="[^"]+"')
CANONICAL_PATTERN = re.compile(r'<link rel="canonical" href="[^"]+"')
LICENSE_HEADER_PATTERN = re.compile(r"\A((?://[^\n]*(?:SPDX-License-Identifier|Copyright)[^\n]*\n)+)")


def build_site():
    site = {"library": describe_library(), "official_links": load_official_links()}
    reset_output()
    pages = [build_page(source, site) for source in sorted(PAGES_SOURCE.rglob("*")) if source.is_file()]
    rendered_pages = [page for page in pages if page]
    refuse_unused_official_links(site["official_links"], rendered_pages)
    refuse_missing_search_metadata(rendered_pages)
    refuse_duplicate_titles(rendered_pages)
    library_path = bundle_library(site["library"])
    minified_count = minify_scripts(PAGES_DIRECTORY)
    indexed_pages = [page for page in rendered_pages if is_indexed(page)]
    write_sitemap(indexed_pages)
    write_robots()
    refuse_broken_internal_links(rendered_pages)
    print(f"built {len(rendered_pages)} pages ({len(indexed_pages)} in the sitemap) and minified {minified_count} scripts")
    print(f"index.html, 404.html and {library_path.name} at the root, everything else in {PAGES_DIRECTORY_NAME}/")


def describe_library():
    entry_point = LIBRARY_SOURCE / "index.js"
    match = LIBRARY_VERSION_PATTERN.search(entry_point.read_text())
    if not match:
        raise SystemExit(f'{entry_point} must export const VERSION = "x.y.z"')
    version = match.group(1)
    return {"name": LIBRARY_NAME, "entry_point": entry_point, "version": version,
            "file_name": f"{LIBRARY_NAME}-{version}{ALREADY_MINIFIED_SUFFIX}"}


def load_official_links():
    official_links = json.loads(OFFICIAL_LINKS_SOURCE.read_text())
    all_links = [link for group in official_links["resource_groups"] for link in group["links"]]
    all_links += [link for links in official_links["page_links"].values() for link in links]
    insecure = sorted({url for _label, url, _summary in all_links if not url.startswith("https://")})
    if insecure:
        raise SystemExit(f"{OFFICIAL_LINKS_SOURCE.name} links must use https:\n  " + "\n  ".join(insecure))
    return official_links


def reset_output():
    if PAGES_DIRECTORY.exists():
        shutil.rmtree(PAGES_DIRECTORY)
    for stale_bundle in OUTPUT_DIRECTORY.glob(f"{LIBRARY_NAME}-*{ALREADY_MINIFIED_SUFFIX}"):
        stale_bundle.unlink()
    shutil.copytree(STATIC_SOURCE, PAGES_DIRECTORY, ignore=shutil.ignore_patterns(".*"))
    (OUTPUT_DIRECTORY / ".nojekyll").write_text("")


def output_path_for(relative_source):
    if relative_source in ROOT_PAGES:
        return OUTPUT_DIRECTORY / relative_source
    return PAGES_DIRECTORY / relative_source


def url_path_for(relative_source):
    if relative_source == "index.html":
        return "/"
    if relative_source in ROOT_PAGES:
        return f"/{relative_source}"
    web_path = f"/{PAGES_DIRECTORY_NAME}/{relative_source}"
    return web_path.removesuffix("index.html")


def build_page(source, site):
    if source.name.startswith("."):
        return None
    relative_source = source.relative_to(PAGES_SOURCE).as_posix()
    target = output_path_for(relative_source)
    target.parent.mkdir(parents=True, exist_ok=True)
    if source.suffix != ".html":
        shutil.copyfile(source, target)
        return None
    url_path = url_path_for(relative_source)
    source_html = source.read_text()
    rendered = render_page(source_html, url_path, site)
    target.write_text(rendered)
    return {"source": source, "url_path": url_path, "output": target, "html": rendered,
            "has_official_links": OFFICIAL_LINKS_TOKEN in source_html}


def render_page(source_html, url_path, site):
    expanded = fill_library_tokens(expand_includes(source_html), site["library"])
    expanded = fill_official_links(expanded, url_path, site["official_links"])
    expanded = expanded.replace("{{canonical}}", SITE_URL + url_path).replace("{{origin}}", SITE_URL)
    return mark_current_links(expanded, url_path)


def expand_includes(markup):
    return INCLUDE_PATTERN.sub(lambda match: expand_includes((PARTIALS_SOURCE / match.group(1)).read_text()), markup)


def fill_library_tokens(markup, library):
    def replace_token(match):
        library_name, field = match.groups()
        if library_name != library["name"]:
            raise SystemExit(f"unknown library in {match.group(0)}")
        return library["file_name"] if field == "file" else library["version"]
    return LIBRARY_TOKEN_PATTERN.sub(replace_token, markup)


def official_links_key(url_path):
    return url_path.lstrip("/")


def fill_official_links(markup, url_path, official_links):
    if OFFICIAL_LINKS_TOKEN in markup:
        links = official_links["page_links"].get(official_links_key(url_path))
        if not links:
            raise SystemExit(f"{url_path} uses {OFFICIAL_LINKS_TOKEN} but {OFFICIAL_LINKS_SOURCE.name} has no links for it")
        markup = markup.replace(OFFICIAL_LINKS_TOKEN, render_official_links(links))
    if OFFICIAL_RESOURCES_TOKEN in markup:
        markup = markup.replace(OFFICIAL_RESOURCES_TOKEN, render_official_resources(official_links["resource_groups"]))
    return markup


def render_official_links(links):
    return (f'<h2 id="official-docs">{OFFICIAL_LINKS_HEADING}</h2>\n'
            '<p class="official-links-lead">Go deeper with the specifications and reference documentation:</p>\n'
            f'{render_link_cards(links)}')


def render_official_resources(groups):
    contents = "".join(f'<li><a href="#{group["id"]}">{html.escape(group["title"])}</a></li>' for group in groups)
    sections = "".join(
        f'<section class="section section-tight" aria-labelledby="{group["id"]}">'
        f'<h2 id="{group["id"]}">{html.escape(group["title"])}</h2>'
        f'<p class="section-lead">{html.escape(group["lead"])}</p>{render_link_cards(group["links"])}</section>\n'
        for group in groups
    )
    contents_nav = (f'<nav class="section section-tight resource-contents" aria-label="On this page">'
                    f'<ul>{contents}</ul></nav>\n')
    return contents_nav + sections + render_resources_schema(groups)


def render_link_cards(links):
    cards = "".join(
        f'<li><a class="card" href="{html.escape(url)}" rel="noopener external">'
        f'<span class="card-kicker">{html.escape(url_host(url))}</span>'
        f'<h3>{html.escape(label)}</h3><p>{html.escape(summary)}</p></a></li>'
        for label, url, summary in links
    )
    return f'<ul class="cards official-cards">{cards}</ul>'


def url_host(url):
    return url.split("//", 1)[1].split("/", 1)[0].removeprefix("www.")


def render_resources_schema(groups):
    links = [link for group in groups for link in group["links"]]
    schema = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Official WebGPU and GPU resources",
        "itemListElement": [
            {"@type": "ListItem", "position": position, "name": label, "url": url, "description": summary}
            for position, (label, url, summary) in enumerate(links, start=1)
        ],
    }
    payload = json.dumps(schema, indent=2, ensure_ascii=False).replace("</", "<\\/")
    return f'<script type="application/ld+json">\n{payload}\n</script>\n'


def refuse_unused_official_links(official_links, pages):
    pages_with_token = {official_links_key(page["url_path"]) for page in pages if page["has_official_links"]}
    unused = sorted(set(official_links["page_links"]) - pages_with_token)
    if unused:
        raise SystemExit(f"{OFFICIAL_LINKS_SOURCE.name} lists links for pages without {OFFICIAL_LINKS_TOKEN}:\n  "
                         + "\n  ".join(unused))


def mark_current_links(markup, url_path):
    def mark(match):
        before, href, after = match.groups()
        attributes = before + after
        if "aria-current" in attributes:
            return match.group(0)
        if href == url_path:
            return f'<a {before}href="{href}" aria-current="page"{after}>'
        is_section_link = "data-nav-section" in attributes
        if is_section_link and href != "/" and url_path.startswith(href):
            return f'<a {before}href="{href}" aria-current="true"{after}>'
        return match.group(0)
    return ANCHOR_PATTERN.sub(mark, markup)


def is_indexed(page):
    if NOINDEX_PATTERN.search(page["html"]):
        return False
    return not page["url_path"].startswith(SITEMAP_EXCLUDED_PREFIXES)


def refuse_missing_search_metadata(pages):
    problems = []
    for page in pages:
        if not is_indexed(page):
            continue
        if not TITLE_PATTERN.search(page["html"]):
            problems.append(f"{page['url_path']} has no <title>")
        if not DESCRIPTION_PATTERN.search(page["html"]):
            problems.append(f"{page['url_path']} has no meta description")
        if not CANONICAL_PATTERN.search(page["html"]):
            problems.append(f"{page['url_path']} has no canonical link (add {{{{include head.html}}}})")
    if problems:
        raise SystemExit("pages search engines cannot describe:\n  " + "\n  ".join(problems))


def refuse_duplicate_titles(pages):
    pages_by_title = {}
    for page in pages:
        if is_indexed(page):
            title = TITLE_PATTERN.search(page["html"]).group(1).strip()
            pages_by_title.setdefault(title, []).append(page["url_path"])
    duplicates = [f"{title}: {', '.join(paths)}" for title, paths in pages_by_title.items() if len(paths) > 1]
    if duplicates:
        raise SystemExit("pages share a <title>:\n  " + "\n  ".join(duplicates))


def refuse_broken_internal_links(pages):
    broken = sorted({f"{page['url_path']} -> {target}" for page in pages
                     for target in internal_references(page["html"])
                     if target not in OPTIONAL_ASSETS and not resolves_to_file(target)})
    if broken:
        raise SystemExit("broken internal links:\n  " + "\n  ".join(broken))


def internal_references(markup):
    references = INTERNAL_REFERENCE_PATTERN.findall(markup)
    for import_map in IMPORT_MAP_PATTERN.findall(markup):
        references.extend(IMPORT_MAP_TARGET_PATTERN.findall(import_map))
    return references


def resolves_to_file(url_path):
    target = OUTPUT_DIRECTORY / url_path.lstrip("/")
    if url_path.endswith("/"):
        target = target / "index.html"
    return target.is_file()


def find_esbuild():
    if shutil.which("npx"):
        return ["npx", "--yes", f"esbuild@{ESBUILD_VERSION}"]
    raise SystemExit(f"Node.js 18+ is needed: the build runs esbuild {ESBUILD_VERSION} through npx")


def run_esbuild(arguments):
    subprocess.run(find_esbuild() + arguments + ["--log-level=warning"], check=True, cwd=REPO_ROOT)


def library_banner(library):
    return (f"/*! {library['name']} v{library['version']} | SPDX-License-Identifier: {LICENSE_IDENTIFIER} | "
            f"{COPYRIGHT_NOTICE} | {SITE_URL}/{PAGES_DIRECTORY_NAME}/{library['name']}/ | {REPOSITORY_URL} */")


def bundle_library(library):
    output_path = OUTPUT_DIRECTORY / library["file_name"]
    run_esbuild([str(library["entry_point"]), "--bundle", "--format=esm", "--minify", f"--target={ESBUILD_TARGET}",
                 f"--outfile={output_path}", f"--banner:js={library_banner(library)}"])
    return output_path


def minify_scripts(directory):
    script_paths = [path for path in sorted(directory.rglob("*.js")) if not path.name.endswith(ALREADY_MINIFIED_SUFFIX)]
    if not script_paths:
        return 0
    license_headers = {path: read_license_header(path) for path in script_paths}
    run_esbuild([str(path) for path in script_paths]
                + ["--minify", f"--outdir={directory}", f"--outbase={directory}", "--allow-overwrite"])
    for path, header in license_headers.items():
        if header:
            path.write_text(header + path.read_text())
    return len(script_paths)


def read_license_header(path):
    match = LICENSE_HEADER_PATTERN.match(path.read_text())
    return match.group(1) if match else ""


def write_sitemap(pages):
    last_modified = source_dates([page["source"] for page in pages])
    entries = "".join(
        f"  <url>\n    <loc>{SITE_URL}{page['url_path']}</loc>\n    <lastmod>{last_modified[page['source']]}</lastmod>\n"
        f"    <priority>{sitemap_priority(page['url_path'])}</priority>\n  </url>\n"
        for page in sorted(pages, key=lambda page: page["url_path"])
    )
    sitemap = ('<?xml version="1.0" encoding="UTF-8"?>\n'
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + entries + "</urlset>\n")
    (OUTPUT_DIRECTORY / "sitemap.xml").write_text(sitemap)


def sitemap_priority(url_path):
    depth = len(url_path.removeprefix(f"/{PAGES_DIRECTORY_NAME}").strip("/").split("/")) if url_path != "/" else 0
    return SITEMAP_PRIORITY_BY_DEPTH.get(depth, DEFAULT_SITEMAP_PRIORITY)


def source_dates(sources):
    today = date.today().isoformat()
    changed = uncommitted_files()
    return {source: today if source in changed else last_commit_date(source) or today for source in sources}


def uncommitted_files():
    result = run_git(["status", "--porcelain", "--untracked-files=all", "--", str(PAGES_SOURCE), str(PARTIALS_SOURCE)])
    if result is None:
        return set()
    return {(REPO_ROOT / line[3:].split(" -> ")[-1].strip('"')).resolve() for line in result.splitlines() if line}


def last_commit_date(source):
    return run_git(["log", "-1", "--format=%cs", "--", str(source)])


def run_git(arguments):
    try:
        result = subprocess.run(["git", *arguments], cwd=REPO_ROOT, capture_output=True, text=True, check=True)
    except (OSError, subprocess.CalledProcessError):
        return None
    return result.stdout.strip() or None


def write_robots():
    (OUTPUT_DIRECTORY / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {SITE_URL}/sitemap.xml\n")


if __name__ == "__main__":
    build_site()
