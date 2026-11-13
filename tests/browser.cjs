const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.join(__dirname, ".."),
  dist = path.join(root, "docs"),
  out = path.join(root, ".artifacts/react-flow-review");
const site = process.env.SITE_URL || "https://parametron.test/";
fs.mkdirSync(out, { recursive: true });
let browser;
(async () => {
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const errors = [];
  async function open(width, game) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      hasTouch: width < 700,
      isMobile: width < 700,
      reducedMotion: "reduce",
    });
    if (!process.env.SITE_URL)
      await context.route("https://parametron.test/**", async (route) => {
        const name = decodeURIComponent(
          new URL(route.request().url()).pathname,
        );
        const file = path.resolve(
          dist,
          "." + (name === "/" ? "/index.html" : name),
        );
        if (!file.startsWith(dist + path.sep))
          return route.fulfill({ status: 403, body: "" });
        await route.fulfill({
          path: file,
          contentType: file.endsWith(".js")
            ? "application/javascript"
            : file.endsWith(".css")
              ? "text/css"
              : "text/html",
        });
      });
    if (game)
      await context.addInitScript((game) => {
        if (!localStorage.getItem("parametron-puzzle:v2"))
          localStorage.setItem("parametron-puzzle:v2", JSON.stringify(game));
      }, game);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(site, { waitUntil: "networkidle" });
    await page.locator(".react-flow__node").first().waitFor();
    return { page, context };
  }
  const stored = (page) =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("parametron-puzzle:v2")),
    );
  async function fit(page) {
    await page.locator(".react-flow__controls-fitview").click();
    await page.waitForTimeout(70);
  }
  async function connect(page, source, target, touch = false) {
    await fit(page);
    if (touch) {
      await page.locator(`[data-testid="source-${source}"]`).tap();
      await page.locator(`[data-testid="target-${target}"]`).tap();
    } else {
      await page.locator(`[data-testid="source-${source}"]`).click();
      await page.locator(`[data-testid="target-${target}"]`).click();
    }
    await page.waitForTimeout(25);
  }
  async function details(page, name) {
    await fit(page);
    await page
      .getByRole("button", { name: `${name}の詳細を開く`, exact: true })
      .click();
    await page
      .getByRole("button", { name: `${name}の詳細を畳む`, exact: true })
      .waitFor();
    await page.waitForTimeout(80);
  }
  async function collapse(page, name) {
    await page
      .getByRole("button", { name: `${name}の詳細を畳む`, exact: true })
      .click();
    await page
      .getByRole("button", { name: `${name}の詳細を開く`, exact: true })
      .waitFor();
    await fit(page);
  }
  async function wire(page, node, port, source) {
    await connect(page, source.replace("!", ""), `${node - 1}-${port - 1}`);
    if (source.startsWith("!")) {
      await details(page, `P${node}`);
      await page
        .getByRole("button", {
          name: `P${node}の入力${port}を反転`,
          exact: true,
        })
        .click();
      await collapse(page, `P${node}`);
    }
  }
  async function clear(page, count) {
    await page.waitForFunction(
      (count) =>
        document
          .querySelector('[data-testid="status"]')
          ?.textContent.includes("クリア！ 使用" + count + "個"),
      count,
      { timeout: 3000 },
    );
  }
  for (const width of [1280, 390, 320]) {
    const { page, context } = await open(width);
    await page.screenshot({
      path: path.join(out, `intro-${width}.png`),
      fullPage: true,
    });
    assert.equal(await page.locator(".react-flow__attribution").count(), 1);
    assert.equal(await page.locator('[data-presentation="symbol"]').count(), 1);
    const canvas = await page.locator(".flow-frame").boundingBox();
    assert.ok(
      canvas.height > 600,
      "The circuit must use most of the viewport height",
    );
    const sidebar = page.getByRole("button", {
      name: "説明を畳む",
      exact: true,
    });
    if (width === 1280) {
      const before = canvas.width;
      await sidebar.click();
      assert.ok(
        (await page.locator(".flow-frame").boundingBox()).width > before + 250,
      );
      await page
        .getByRole("button", { name: "説明とテスト", exact: true })
        .click();
    } else {
      await page
        .getByRole("button", { name: "説明とテスト", exact: true })
        .click();
      await page.locator("#lesson-panel").waitFor();
      await sidebar.click();
    }
    await page
      .getByRole("button", { name: "入力Bを切り替える", exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector('[data-testid="status"]')
        .textContent.includes("1が2票"),
    );
    await page.getByRole("button", { name: /次へ：AND/ }).click();
    await connect(page, "0", "0-2", width < 700);
    await clear(page, 1);
    const circuit = JSON.stringify((await stored(page)).boards.and.gates);
    await details(page, "P1");
    assert.equal(await page.locator('[data-presentation="detail"]').count(), 1);
    if (width < 700)
      assert.ok(
        (await page.locator('[data-presentation="detail"]').boundingBox())
          .width >= 230,
        "Details should open at a readable scale",
      );
    await page.screenshot({
      path: path.join(out, `detail-${width}.png`),
      fullPage: true,
    });
    await collapse(page, "P1");
    assert.equal(
      JSON.stringify((await stored(page)).boards.and.gates),
      circuit,
      "Presentation changes must preserve the circuit",
    );
    if (width === 1280) {
      const point = await page
        .locator(".react-flow__edge-path")
        .first()
        .evaluate((path) => {
          const p = path.getPointAtLength(path.getTotalLength() * 0.5),
            m = path.getScreenCTM();
          return {
            x: m.a * p.x + m.c * p.y + m.e,
            y: m.b * p.x + m.d * p.y + m.f,
          };
        });
      await page.mouse.click(point.x, point.y);
      await page.locator(".edge-inspector").waitFor();
      assert.equal(await page.locator(".wire-active").count(), 1);
      assert.ok((await page.locator(".wire-muted").count()) > 0);
      assert.equal(await page.locator(".wire-endpoint").count(), 2);
      await page.screenshot({
        path: path.join(out, "wire-selection.png"),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "配線の選択を解除", exact: true })
        .click();
    }
    if (width === 1280) {
      await page
        .getByRole("button", { name: "ひとつ戻す", exact: true })
        .click();
      await fit(page);
      await page
        .locator('[data-testid="source-0"]')
        .dragTo(page.locator('[data-testid="target-0-2"]'));
      await clear(page, 1);
    }
    await page.screenshot({
      path: path.join(out, `and-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: /次へ：OR/ }).click();
    await connect(page, "1", "0-2", width < 700);
    await clear(page, 1);
    if (width === 1280) {
      await page.getByRole("button", { name: /次へ：XOR/ }).click();
      for (const [i, ports] of [
        ["A", "B", "0"],
        ["A", "B", "1"],
        ["!P1", "P2", "0"],
      ].entries())
        for (const [j, source] of ports.entries())
          await wire(page, i + 1, j + 1, source);
      await clear(page, 3);
      await page.screenshot({
        path: path.join(out, "xor.png"),
        fullPage: true,
      });
      await page.getByRole("button", { name: /次へ：半加算器/ }).click();
      for (const node of [1, 2]) {
        await wire(page, node, 1, "A");
        await wire(page, node, 2, "B");
      }
      await clear(page, 4);
      await page.getByRole("button", { name: /次へ：全加算器/ }).click();
      for (const [i, ports] of [
        ["A", "B"],
        ["P1", "Cin"],
        ["A", "B"],
        ["P1", "Cin"],
        ["P3", "P4"],
      ].entries())
        for (const [j, source] of ports.entries())
          await wire(page, i + 1, j + 1, source);
      await clear(page, 9);
      await fit(page);
      await page.screenshot({
        path: path.join(out, "full-adder.png"),
        fullPage: true,
      });
      const title = page.locator(
        '.react-flow__node[data-id="gate:0"] .node-title',
      );
      const before = await title.boundingBox();
      await page.mouse.move(before.x + 30, before.y + 20);
      await page.mouse.down();
      await page.mouse.move(before.x + 110, before.y + 80, { steps: 8 });
      await page.mouse.up();
      await page.waitForFunction(
        () =>
          JSON.parse(localStorage.getItem("parametron-puzzle:v2")).boards.full
            .flow?.symbolWide,
      );
      const saved = await stored(page);
      assert.equal(saved.bests.full, 9);
      await page.reload({ waitUntil: "networkidle" });
      await clear(page, 9);
      assert.deepEqual(
        (await stored(page)).boards.full.flow.symbolWide,
        saved.boards.full.flow.symbolWide,
      );
      const node = page.locator('.react-flow__node[data-id="gate:0"]');
      await node.locator(".node-title").click();
      await node.focus();
      await page.keyboard.press("ArrowDown");
      await page.waitForFunction(
        (y) =>
          JSON.parse(localStorage.getItem("parametron-puzzle:v2")).boards.full
            .flow.symbolWide["gate:0"].y !== y,
        saved.boards.full.flow.symbolWide["gate:0"].y,
      );
      await page
        .getByRole("button", { name: "配置を整える", exact: true })
        .click();
      await clear(page, 9);
      await details(page, "P1");
      await page.getByRole("button", { name: "P1を展開", exact: true }).click();
      await clear(page, 9);
      assert.equal((await stored(page)).boards.full.gates.length, 7);
      await page
        .locator('[data-presentation="detail"]')
        .waitFor({ state: "hidden" });
      assert.equal(
        await page.locator('[data-presentation="detail"]').count(),
        0,
        "Expanding a part returns to symbols",
      );
      for (let i = 7; i >= 1; i--) {
        await details(page, `P${i}`);
        await page
          .getByRole("button", { name: `P${i}を取り外す`, exact: true })
          .click();
        if (
          await page
            .getByRole("button", { name: "すべて畳む", exact: true })
            .count()
        )
          await page
            .getByRole("button", { name: "すべて畳む", exact: true })
            .click();
      }
      for (let i = 0; i < 3; i++)
        await page.getByRole("button", { name: "追加", exact: true }).click();
      for (const [i, ports] of [
        ["A", "B", "Cin"],
        ["A", "B", "!Cin"],
        ["!P1", "P2", "Cin"],
      ].entries())
        for (const [j, source] of ports.entries())
          await wire(page, i + 1, j + 1, source);
      await connect(page, "P3", "S");
      await connect(page, "P1", "Cout");
      await clear(page, 3);
      await connect(page, "P2", "0-0");
      assert.equal(
        (await stored(page)).boards.full.gates[0].ports[0].source,
        "P2",
      );
      await connect(page, "P1", "1-0");
      await page.keyboard.press("Escape");
      assert.equal(
        (await stored(page)).boards.full.gates[1].ports[0].source,
        "A",
        "React Flow must reject a cyclic wire",
      );
      await page
        .getByRole("button", { name: "ひとつ戻す", exact: true })
        .click();
      await clear(page, 3);
      await page.screenshot({
        path: path.join(out, "full-adder-optimal.png"),
        fullPage: true,
      });
    }
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight + 1,
      ),
      true,
      "The workspace must fit the screen without page scrolling",
    );
    await context.close();
  }
  await browser.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: React Flow native drag/click/tap connections, node and keyboard movement, saved progress/positions, Dagre layout, part expansion, 9- and 3-element full adders, reversed creation order, cycle rejection, responsive pages.",
  );
})().catch(async (error) => {
  console.error(error);
  await browser?.close();
  process.exitCode = 1;
});
