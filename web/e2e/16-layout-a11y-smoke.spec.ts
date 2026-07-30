import { test as base, expect, type Page } from "@playwright/test";
import { test as authed } from "./fixtures";

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

function watchPageHealth(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

base.describe("responsive layout smoke", () => {
  base("public landing fits mobile, landscape, and desktop without console errors", async ({ page }) => {
    const errors = watchPageHealth(page);

    for (const viewport of [
      { width: 375, height: 812 },
      { width: 812, height: 375 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await expect(page.getByRole("heading", { name: /automated money routing/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /get started/i })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }

    expect(errors).toEqual([]);
  });
});

authed.describe("authenticated shell layout smoke", () => {
  authed("core app routes render across mobile and desktop with keyboard focus visible", async ({ page }) => {
    const errors = watchPageHealth(page);
    const routes = [
      { path: "/home", heading: /total balance/i },
      { path: "/shunt", heading: /configure shunt/i },
      { path: "/activity", heading: /activity/i },
      { path: "/settings", heading: /settings/i },
    ];

    for (const viewport of [
      { width: 375, height: 812 },
      { width: 1366, height: 900 },
    ]) {
      await page.setViewportSize(viewport);

      for (const route of routes) {
        await page.goto(route.path);
        await expect(page.getByText(route.heading).first()).toBeVisible();
        await expectNoHorizontalOverflow(page);
      }
    }

    await page.keyboard.press("Tab");
    const outlineWidth = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active) return "0px";
      return getComputedStyle(active).outlineWidth;
    });
    expect(outlineWidth).not.toBe("0px");
    expect(errors).toEqual([]);
  });
});

