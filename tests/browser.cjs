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
  let blueprintGame;
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
  async function inTable(page, action) {
    const closed = !(await page.locator("#lesson-panel").count());
    if (closed)
      await page
        .getByRole("button", { name: "説明とテスト", exact: true })
        .click();
    await action(page.locator(".truth-table"));
    if (closed)
      await page
        .getByRole("button", { name: "説明を畳む", exact: true })
        .click();
  }
  for (const width of [1280, 390, 320]) {
    const { page, context } = await open(width);
    await page.screenshot({
      path: path.join(out, `intro-${width}.png`),
      fullPage: true,
    });
    assert.equal(await page.locator(".react-flow__attribution").count(), 1);
    assert.equal(
      await page
        .locator(".wave, .wave-moving, .symbol-sine, .test-cases")
        .count(),
      0,
    );
    assert.equal(await page.getByRole("button", { name: /振動/ }).count(), 0);
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
    await inTable(page, async (table) => {
      assert.deepEqual(await table.locator("th").allTextContents(), [
        "選択",
        "A",
        "B",
        "Y",
      ]);
      assert.equal(
        await table.getByRole("img", { name: "未接続", exact: true }).count(),
        4,
      );
    });
    await connect(page, "0", "0-2", width < 700);
    await clear(page, 1);
    await inTable(page, async (table) => {
      const cell = table.locator('[data-test-row="3"] td').nth(1);
      if (width < 700) await cell.tap();
      else await cell.click();
      assert.equal((await stored(page)).boards.and.input, 3);
      assert.equal((await stored(page)).motion, undefined);
      await page.waitForFunction(
        () =>
          document.querySelector(
            '.react-flow__node[data-id="output:Y"] .output-value',
          ).textContent === "1",
      );
      assert.equal(
        await table
          .locator('[data-test-row="3"]')
          .getAttribute("data-selected"),
        "true",
      );
      assert.equal(
        await table.getByRole("img", { name: "一致", exact: true }).count(),
        4,
      );
      await table.screenshot({
        path: path.join(out, `truth-table-${width}.png`),
      });
      await table.locator('[data-test-row="0"] button').focus();
      await page.keyboard.press("Enter");
      assert.equal((await stored(page)).boards.and.input, 0);
    });
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
    if (width === 1280) {
      await connect(page, "0", "0-2");
      await inTable(page, async (table) => {
        assert.equal(
          await table.getByRole("img", { name: "不一致", exact: true }).count(),
          2,
        );
        assert.equal(
          await table.locator('[data-test-row="1"] td').last().textContent(),
          "1❌",
        );
      });
    }
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
      const half = (await stored(page)).boards.half;
      assert.equal(half.gates.length, 4);
      assert.equal(
        await page.locator('[data-presentation="blueprint"]').count(),
        2,
      );
      for (const [i, gate] of half.gates.entries())
        for (const [p, edge] of gate.ports.entries())
          if (edge.socket) await wire(page, i + 1, p + 1, edge.socket);
      await page.screenshot({
        path: path.join(out, "half-blueprints.png"),
        fullPage: true,
      });
      await clear(page, 4);
      await inTable(page, async (table) => {
        assert.deepEqual(await table.locator("th").allTextContents(), [
          "選択",
          "A",
          "B",
          "S",
          "C",
        ]);
        assert.equal(
          await table.locator("tbody tr").first().locator("td").count(),
          5,
          "One compact column per output",
        );
      });
      await page.getByRole("button", { name: /次へ：全加算器/ }).click();
      const full = (await stored(page)).boards.full;
      assert.equal(full.gates.length, 9);
      assert.ok(full.gates.every((gate) => gate.type === "MAJ"));
      assert.equal(
        await page.locator('[data-presentation="blueprint"]').count(),
        5,
      );
      const bindings = [
        { A: "A", B: "B" },
        { A: "P3", B: "Cin" },
        { A: "A", B: "B" },
        { A: "P3", B: "Cin" },
        { A: "P7", B: "P8" },
      ];
      for (const [g, group] of full.blueprints.entries())
        for (const i of group.gates)
          for (const [p, edge] of full.gates[i].ports.entries())
            if (edge.socket)
              await wire(page, i + 1, p + 1, bindings[g][edge.socket]);
      await clear(page, 9);
      blueprintGame = await stored(page);
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
            .flow?.blueprintWide,
      );
      const saved = await stored(page);
      assert.equal(saved.bests.full, 9);
      await page.reload({ waitUntil: "networkidle" });
      await clear(page, 9);
      assert.deepEqual(
        (await stored(page)).boards.full.flow.blueprintWide,
        saved.boards.full.flow.blueprintWide,
      );
      const node = page.locator('.react-flow__node[data-id="gate:0"]');
      await node.locator(".node-title").click();
      await node.focus();
      await page.keyboard.press("ArrowUp");
      await page.waitForFunction(
        (y) =>
          JSON.parse(localStorage.getItem("parametron-puzzle:v2")).boards.full
            .flow.blueprintWide["gate:0"].y !== y,
        saved.boards.full.flow.blueprintWide["gate:0"].y,
      );
      await page
        .getByRole("button", { name: "配置を整える", exact: true })
        .click();
      await clear(page, 9);
      const physical = (await stored(page)).boards.full.gates;
      await fit(page);
      await page
        .getByRole("button", { name: "bp1の枠を外す", exact: true })
        .click();
      assert.deepEqual(
        (await stored(page)).boards.full.gates,
        physical,
        "Removing a frame must preserve the actual circuit",
      );
      await clear(page, 9);
      await page
        .getByRole("button", { name: "ひとつ戻す", exact: true })
        .click();
      await clear(page, 9);
      // Native parent-node movement carries its real parametron children.
      await fit(page);
      const groupTitle = page.locator(
        '.react-flow__node[data-id="blueprint:bp1"] > .blueprint-frame > .node-title',
      );
      const groupBox = await groupTitle.boundingBox();
      await page.mouse.move(groupBox.x + 15, groupBox.y + 12);
      await page.mouse.down();
      await page.mouse.move(groupBox.x + 55, groupBox.y + 44, { steps: 8 });
      await page.mouse.up();
      for (const id of ["bp5", "bp4", "bp3", "bp2", "bp1"]) {
        await fit(page);
        await page
          .getByRole("button", { name: id + "の回路を取り外す", exact: true })
          .click();
      }
      assert.equal((await stored(page)).boards.full.gates.length, 0);
      // A palette entry stamps a saved raw circuit, with constants and inversions.
      await page
        .getByRole("combobox", { name: "配置する素子・ブループリント" })
        .selectOption("XOR");
      await page.getByRole("button", { name: "設置", exact: true }).click();
      const stamp = (await stored(page)).boards.full;
      assert.equal(stamp.gates.length, 3);
      assert.ok(stamp.gates.every((gate) => gate.type === "MAJ"));
      assert.equal(stamp.gates[2].ports[0].inverted, true);
      await page.locator('[data-presentation="blueprint"]').waitFor();
      await page.waitForFunction(() => {
        const frame = document
          .querySelector(".flow-frame")
          .getBoundingClientRect();
        return [...document.querySelectorAll(".react-flow__node")].every(
          (node) => {
            const r = node.getBoundingClientRect();
            return (
              r.left >= frame.left - 1 &&
              r.right <= frame.right + 1 &&
              r.top >= frame.top - 1 &&
              r.bottom <= frame.bottom + 1
            );
          },
        );
      });
      await page.screenshot({
        path: path.join(out, "placed-blueprint.png"),
        fullPage: true,
      });
      await fit(page);
      await page
        .getByRole("button", {
          name: stamp.blueprints[0].id + "の回路を取り外す",
          exact: true,
        })
        .click();
      await page
        .getByRole("combobox", { name: "配置する素子・ブループリント" })
        .selectOption("MAJ");
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
    if (width < 700) {
      const fixture = JSON.parse(JSON.stringify(blueprintGame));
      fixture.level = 5;
      fixture.boards.full = {
        gates: [],
        outputs: {
          S: { source: "", inverted: false },
          Cout: { source: "", inverted: false },
        },
        input: 0,
      };
      const mobile = await open(width, fixture);
      await mobile.page
        .getByRole("combobox", { name: "配置する素子・ブループリント" })
        .selectOption("XOR");
      await mobile.page
        .getByRole("button", { name: "設置", exact: true })
        .tap();
      await mobile.page.locator('[data-presentation="blueprint"]').waitFor();
      assert.equal((await stored(mobile.page)).boards.full.gates.length, 3);
      await connect(mobile.page, "A", "0-0", true);
      assert.equal(
        (await stored(mobile.page)).boards.full.gates[0].ports[0].source,
        "A",
      );
      await details(mobile.page, "P1");
      assert.ok(
        (
          await mobile.page
            .locator('[data-presentation="detail"]')
            .boundingBox()
        ).width >= 220,
      );
      await collapse(mobile.page, "P1");
      await mobile.page.screenshot({
        path: path.join(out, `blueprint-${width}.png`),
        fullPage: true,
      });
      await mobile.context.close();
    }
  }
  await browser.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: React Flow native drag/click/tap connections, node and keyboard movement, saved progress/positions, Dagre layout, raw parametron blueprint placement/ungrouping/removal, 9- and 3-element full adders, reversed creation order, cycle rejection, responsive pages.",
  );
})().catch(async (error) => {
  console.error(error);
  await browser?.close();
  process.exitCode = 1;
});
