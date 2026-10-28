import getpass
import requests

BASE = "https://api.github.com"

def main():
    token = getpass.getpass("GitHub token (input hidden): ").strip()

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    tests = [
        ("Authentication", f"{BASE}/user"),
        ("Rate limit", f"{BASE}/rate_limit"),
        ("Issue search", f"{BASE}/search/issues?q=is:issue+is:open+label:good-first-issue&per_page=1"),
    ]

    session = requests.Session()
    session.headers.update(headers)

    try:
        for name, url in tests:
            print(f"\n--- {name} ---")
            try:
                response = session.get(url, timeout=15)
                print("HTTP status:", response.status_code)

                if response.status_code == 401:
                    print("Token invalid, expired, or revoked.")
                    continue

                if response.status_code == 403:
                    print("Forbidden or rate limit exceeded.")
                    print("Remaining:", response.headers.get("X-RateLimit-Remaining"))
                    print("Reset:", response.headers.get("X-RateLimit-Reset"))
                    continue

                if response.status_code == 429:
                    print("Rate limited. Retry later.")
                    continue

                response.raise_for_status()
                data = response.json()

                if name == "Authentication":
                    print("Authenticated as:", data.get("login"))

                elif name == "Rate limit":
                    for key in ("core", "search"):
                        info = data["resources"].get(key, {})
                        print(
                            f"{key}: remaining={info.get('remaining')}, "
                            f"limit={info.get('limit')}"
                        )

                else:
                    print("Search successful.")
                    print("Total matching issues:", data.get("total_count"))
                    for item in data.get("items", []):
                        print(item["html_url"])

            except requests.RequestException as error:
                print("Request failed:", error)

    finally:
        session.close()
        token = None

if __name__ == "__main__":
    main()