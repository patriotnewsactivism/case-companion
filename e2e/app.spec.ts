import { expect, test } from "@playwright/test";

test.describe("CaseBuddy Public Journeys", () => {
  test("loads landing page and can navigate to login", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: /Turn Massive Discovery Into/i }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });

  test("redirects protected route to login for unauthenticated users", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });

  test("renders 404 page and returns home", async ({ page }) => {
    await page.goto("/this-route-does-not-exist", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByText("Oops! Page not found")).toBeVisible();

    await page.getByRole("link", { name: "Return to Home" }).click();
    await expect(page).toHaveURL("/");
  });
});
