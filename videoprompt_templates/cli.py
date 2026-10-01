"""Command-line access to the VideoPrompt template library.

Usage:
  vp-templates                       print one random template
  vp-templates random -p sora        random template from one platform
  vp-templates random -c Cinematic   random template from one category
  vp-templates search "neon city"    full-text search
  vp-templates platforms             list platforms with template counts
  vp-templates count                 total template count
"""
import argparse
import json
import os
import random
import sys


def _load():
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, "data", "templates.json")
    if not os.path.exists(path):
        path = os.path.join(here, "..", "templates", "templates.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _fmt(t, full=True):
    lines = [f"◆ {t['title']}  —  {t['platform_name']} · {t['category']}", ""]
    lines.append(t["prompt"])
    if full and t.get("tips"):
        lines.append("")
        lines.append("Tips: " + t["tips"])
    lines.append("")
    lines.append("URL: https://videoprompts.tools/%s/%s/" % (t["platform"], t["slug"]))
    return "\n".join(lines)


def main(argv=None):
    p = argparse.ArgumentParser(prog="vp-templates", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd")

    pr = sub.add_parser("random", help="print one random template")
    pr.add_argument("-p", "--platform", help="filter by platform slug (e.g. sora, kling)")
    pr.add_argument("-c", "--category", help="filter by category")

    ps = sub.add_parser("search", help="full-text search")
    ps.add_argument("query")
    ps.add_argument("-n", "--limit", type=int, default=5)

    sub.add_parser("platforms", help="list platforms with template counts")
    sub.add_parser("count", help="total template count")

    args = p.parse_args(argv)
    lib = _load()
    if not lib:
        print("no templates found", file=sys.stderr)
        return 1

    if args.cmd == "search":
        q = args.query.lower()
        hits = [t for t in lib if q in json.dumps(t, ensure_ascii=False).lower()][: args.limit]
        if not hits:
            print("no match")
            return 1
        print("\n\n".join(_fmt(t) for t in hits))
        return 0

    if args.cmd == "platforms":
        from collections import Counter
        c = Counter(t["platform_name"] for t in lib)
        for name, n in c.most_common():
            print(f"{n:>3}  {name}")
        return 0

    if args.cmd == "count":
        print(len(lib))
        return 0

    # default / random
    pool = lib
    if getattr(args, "platform", None):
        pool = [t for t in pool if t["platform"] == args.platform]
    if getattr(args, "category", None):
        pool = [t for t in pool if t["category"].lower() == args.category.lower()]
    if not pool:
        print("no template matches the filters", file=sys.stderr)
        return 1
    print(_fmt(random.choice(pool)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
