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
  const clearedDialogs = new Set();
  const minimumDialogs = new Set();
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
    const welcome = page.getByRole("button", {
      name: "回路で試す",
      exact: true,
    });
    if (await welcome.isVisible()) {
      assert.ok(await welcome.isDisabled());
      assert.ok(
        await page
          .getByRole("heading", { name: /小さな計算機を作ろう/ })
          .isVisible(),
      );
      await page.screenshot({
        path: path.join(out, "welcome-" + width + ".png"),
        fullPage: true,
      });
      const practice = page.getByRole("button", {
        name: "数字を1に切り替える",
        exact: true,
      });
      if (width === 1280) {
        await practice.focus();
        await page.keyboard.press("Space");
      } else await practice.tap();
      assert.equal(
        await page.locator(".practice-controls output").textContent(),
        "1",
      );
      assert.ok(await welcome.isEnabled());
      await page.screenshot({
        path: path.join(out, "welcome-success-" + width + ".png"),
        fullPage: true,
      });
      await welcome.click();
    }
    await page.locator(".react-flow__node").first().waitFor();
    return { page, context };
  }
  const stored = (page) =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("parametron-puzzle:v2")),
    );
  async function reviewClear(page) {
    const dialog = page.getByRole("dialog");
    if (!(await dialog.isVisible())) return;
    const game = await stored(page);
    clearedDialogs.add(game.levelId);
    assert.match(await dialog.locator("h2").textContent(), /クリア！/);
    const optimal = (await dialog.locator("h2").textContent()).includes(
      "理論最小",
    );
    if (optimal) minimumDialogs.add(game.levelId);
    if (game.levelId === "half" && !optimal)
      assert.ok(await dialog.getByText(/通常クリア達成/).isVisible());
    assert.ok(
      await dialog
        .getByText("すべての入力で正しく動きました。", { exact: true })
        .isVisible(),
    );
    if (["and", "or", "xor"].includes(game.levelId)) {
      assert.ok(
        game.library[game.levelId.toUpperCase()],
        "A blueprint must be unlocked when its puzzle is cleared",
      );
      assert.ok(
        await dialog
          .getByRole("region", { name: "獲得したブループリント" })
          .isVisible(),
      );
    }
    const bounds = await dialog.boundingBox(),
      viewport = page.viewportSize();
    assert.ok(
      bounds.x >= 0 &&
        bounds.x + bounds.width <= viewport.width &&
        bounds.y >= 0 &&
        bounds.y + bounds.height <= viewport.height,
      "Clear dialog must fit the viewport",
    );
    await page.screenshot({
      path: path.join(
        out,
        "clear-" +
          game.levelId +
          (optimal ? "-minimum-" : "-") +
          viewport.width +
          ".png",
      ),
      fullPage: true,
    });
    if (game.levelId === "and" && viewport.width === 1280)
      await page.keyboard.press("Escape");
    else
      await dialog
        .getByRole("button", { name: "回路を見る", exact: true })
        .click();
    await dialog.waitFor({ state: "hidden" });
  }
  async function fit(page) {
    await reviewClear(page);
    if (await page.locator(".react-flow__controls-fitview").isVisible())
      await page.locator(".react-flow__controls-fitview").click();
    await page.waitForTimeout(70);
  }
  async function place(page, name = "MAJ") {
    await reviewClear(page);
    await page.waitForTimeout(100);
    const positions = () =>
      page.evaluate(() => ({
        viewport: document.querySelector(".react-flow__viewport").style
          .transform,
        nodes: Object.fromEntries(
          [...document.querySelectorAll(".react-flow__node")].map((node) => [
            node.dataset.id,
            node.style.transform,
          ]),
        ),
      }));
    const before = await positions();
    const game = await stored(page),
      count = game.boards[game.levelId].gates.length;
    await page
      .getByRole("button", {
        name: (name === "MAJ" ? "パラメトロン" : name) + "を配置",
        exact: true,
      })
      .click();
    await page.waitForFunction((count) => {
      const game = JSON.parse(localStorage.getItem("parametron-puzzle:v2")),
        board = game.boards[game.levelId];
      return (
        board.gates.length > count &&
        !!board.flow?.blueprintWide?.["gate:" + (board.gates.length - 1)]
      );
    }, count);
    await page.waitForTimeout(80);
    const after = await positions();
    assert.equal(
      after.viewport,
      before.viewport,
      "Placing a part must not pan or zoom the canvas",
    );
    for (const [id, position] of Object.entries(before.nodes))
      assert.equal(
        after.nodes[id],
        position,
        "Placing a part must not move existing node " + id,
      );
  }
  async function connect(page, source, target, touch = false) {
    await fit(page);
    const guided =
      source === "0" && (await page.locator(".guide-source").count()) > 0;
    if (touch) {
      await page
        .locator(`[data-testid="source-${source}"]`)
        .tap(guided ? { position: { x: 11, y: 6 } } : {});
      if (source === "0" && (await page.locator(".guide-source").count())) {
        await page.locator(".guide-target").waitFor();
        await page.screenshot({
          path: path.join(
            out,
            "wire-guide-target-" + page.viewportSize().width + ".png",
          ),
          fullPage: true,
        });
      }
      await page
        .locator(`[data-testid="target-${target}"]`)
        .tap(guided ? { position: { x: 11, y: 18 } } : {});
    } else {
      await page
        .locator(`[data-testid="source-${source}"]`)
        .click(guided ? { position: { x: 11, y: 6 } } : {});
      if (source === "0" && (await page.locator(".guide-source").count())) {
        await page.locator(".guide-target").waitFor();
        await page.screenshot({
          path: path.join(
            out,
            "wire-guide-target-" + page.viewportSize().width + ".png",
          ),
          fullPage: true,
        });
      }
      await page
        .locator(`[data-testid="target-${target}"]`)
        .click(guided ? { position: { x: 11, y: 18 } } : {});
    }
    await page.waitForTimeout(25);
    await reviewClear(page);
  }
  async function wire(page, node, port, source) {
    await connect(page, source.replace("!", ""), `${node - 1}-${port - 1}`);
    if (source.startsWith("!")) {
      await page
        .getByRole("switch", {
          name: `P${node}の入力${port}を反転`,
          exact: true,
        })
        .click();
      assert.equal(
        await page.locator('[data-presentation="detail"]').count(),
        0,
        "Inversion must work directly on compact symbols",
      );
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
    await reviewClear(page);
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
  async function checkTerminals(page) {
    await fit(page);
    const snapshot = await stored(page);
    const { evaluate, levels } = await import("../editor/src/engine.js");
    const level = levels.find((entry) => entry.id === snapshot.levelId);
    const board = snapshot.boards[level.id];
    const values = evaluate(level, board, board.input, snapshot.library).values;
    const issues = await page.evaluate(async (values) => {
      const errors = [];
      const game = JSON.parse(localStorage.getItem("parametron-puzzle:v2")),
        board = game.boards[game.levelId];
      const checkColor = (name, element, value, rail, property = "stroke") => {
        const bit = value === 0 || value === 1 ? value ^ rail : null;
        const expected =
          bit === 0
            ? "rgb(39, 110, 175)"
            : bit === 1
              ? "rgb(185, 119, 19)"
              : "rgb(146, 160, 176)";
        const actual = getComputedStyle(element)[property];
        if (actual !== expected) errors.push({ name, actual, expected });
      };
      const center = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      };
      const point = (path, end = false) => {
        const p = path.getPointAtLength(end ? path.getTotalLength() : 0),
          m = path.getScreenCTM();
        return {
          x: m.a * p.x + m.c * p.y + m.e,
          y: m.b * p.x + m.d * p.y + m.f,
        };
      };
      const equal = (name, a, b) => {
        if (Math.hypot(a.x - b.x, a.y - b.y) > 2) errors.push({ name, a, b });
      };
      const pole = (handle, rail) =>
        handle.querySelector(rail === 0 ? ".pole-zero" : ".pole-one");
      for (const node of document.querySelectorAll(".react-flow__node-gate")) {
        if (!node.querySelector('[data-presentation="symbol"]')) continue;
        const index = Number(node.getAttribute("data-id").slice(5));
        if (node.querySelectorAll(".aggregation-junction").length !== 2)
          errors.push({ name: "must have exactly two aggregation points" });
        if (node.querySelector(".symbol-body"))
          errors.push({ name: "large circle must not exist" });
        for (const lead of node.querySelectorAll(".parametron-lead")) {
          const port = Number(lead.getAttribute("data-port"));
          const target = node.querySelector(
            '[data-testid="target-' + index + "-" + port + '"]',
          );
          const bridge = lead.querySelector(".wire-bridge");
          const toggle = node.querySelector(
            '[aria-label="P' + (index + 1) + "の入力" + (port + 1) + 'を反転"]',
          );
          if (
            bridge &&
            toggle &&
            Math.abs(center(bridge).x - center(toggle).x) > 2
          )
            errors.push({
              name: "input twist must be centered in its clickable area",
            });
          for (const rail of [0, 1]) {
            const strand = lead.querySelector('[data-rail="' + rail + '"]');
            const destination =
              rail ^ Number(board.gates[index].ports[port].inverted);
            const collector = node.querySelector(
              '.collector[data-input="' +
                port +
                '"][data-rail="' +
                destination +
                '"]',
            );
            equal("input pole", point(strand), center(pole(target, rail)));
            equal("strand to collector", point(strand, true), point(collector));
            const value = values[board.gates[index].ports[port].source];
            checkColor("input wire phase", strand, value, rail);
            checkColor("collector phase after twist", collector, value, rail);
            checkColor(
              "input pole phase",
              pole(target, rail),
              value,
              rail,
              "fill",
            );
          }
        }
        for (const rail of [0, 1]) {
          const junction = node.querySelector(
            '.aggregation-junction[data-rail="' + rail + '"]',
          );
          const collectors = node.querySelectorAll(
            '.collector[data-rail="' + rail + '"]',
          );
          if (collectors.length !== 3)
            errors.push({
              name: "each aggregation point must collect three wires",
              rail,
              count: collectors.length,
            });
          collectors.forEach((path) =>
            equal(
              "three wires to one pole",
              point(path, true),
              center(junction),
            ),
          );
          const output = node.querySelector(
            '.symbol-output-lead[data-rail="' + rail + '"]',
          );
          const source = node.querySelector(
            '[data-testid="source-P' + (index + 1) + '"]',
          );
          equal("junction to output", point(output), center(junction));
          equal("output pole", point(output, true), center(pole(source, rail)));
          const value = values["P" + (index + 1)];
          checkColor("output wire phase", output, value, rail);
          checkColor("aggregation phase", junction, value, rail, "fill");
          checkColor(
            "output pole phase",
            pole(source, rail),
            value,
            rail,
            "fill",
          );
        }
        // Rasterize the actual styled symbol to catch paint covering a wire,
        // even when all path endpoints remain geometrically connected.
        const svg = node.querySelector(".gate-symbol"),
          clone = svg.cloneNode(true);
        const originals = [svg, ...svg.querySelectorAll("*")],
          copies = [clone, ...clone.querySelectorAll("*")];
        originals.forEach((element, i) => {
          const style = getComputedStyle(element);
          copies[i].setAttribute(
            "style",
            ["fill", "stroke", "stroke-width", "stroke-linecap"]
              .map(
                (property) => property + ":" + style.getPropertyValue(property),
              )
              .join(";"),
          );
        });
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        clone.setAttribute("width", "170");
        clone.setAttribute("height", "124");
        const picture = new Image();
        picture.src =
          "data:image/svg+xml," +
          encodeURIComponent(new XMLSerializer().serializeToString(clone));
        await picture.decode();
        const canvas = document.createElement("canvas");
        canvas.width = 170;
        canvas.height = 124;
        const context = canvas.getContext("2d");
        context.drawImage(picture, 0, 0);
        for (const [port, edge] of board.gates[index].ports.entries()) {
          const raw = values[edge.source],
            bit = raw === 0 || raw === 1 ? raw ^ Number(edge.inverted) : null;
          const expected =
            bit === 0
              ? [39, 110, 175]
              : bit === 1
                ? [185, 119, 19]
                : [146, 160, 176];
          const pixel = [
            ...context.getImageData(62, 24 + port * 32, 1, 1).data,
          ];
          if (
            pixel[3] < 120 ||
            expected.some(
              (value, channel) => Math.abs(value - pixel[channel]) > 30,
            )
          )
            errors.push({
              name: "upper wire must remain visibly continuous at the collector join",
              index,
              port,
              pixel,
              expected,
            });
        }
      }
      for (const node of document.querySelectorAll(
        ".react-flow__node-answer",
      )) {
        const wire = node.querySelector(".output-wire");
        if (!wire) continue;
        const name = node.getAttribute("data-id").slice(7),
          target = node.querySelector('[data-testid^="target-"]');
        const card = node.querySelector(".output-node").getBoundingClientRect();
        const bridge = wire.querySelector(".wire-bridge");
        const toggle = node.querySelector(".compact-output-invert");
        if (
          bridge &&
          toggle &&
          Math.abs(center(bridge).x - center(toggle).x) > 2
        )
          errors.push({
            name: "output twist must be centered in its clickable area",
          });
        for (const rail of [0, 1]) {
          const path = wire.querySelector('[data-rail="' + rail + '"]');
          const destination = rail ^ Number(board.outputs[name].inverted);
          equal("answer pole", point(path), center(pole(target, rail)));
          equal("answer body", point(path, true), {
            x: card.left,
            y: center(pole(target, destination)).y,
          });
          const value = values[board.outputs[name].source];
          checkColor("answer wire phase", path, value, rail);
          checkColor(
            "answer pole phase",
            pole(target, rail),
            value,
            rail,
            "fill",
          );
        }
      }
      for (const edge of document.querySelectorAll(".react-flow__edge")) {
        const id = edge.getAttribute("data-id"),
          gate = /^gate:([0-9]+):([0-9]+)$/.exec(id),
          output = /^output:(.+):in$/.exec(id);
        let source, target;
        if (gate) {
          source = board.gates[Number(gate[1])].ports[Number(gate[2])].source;
          target = "target-" + gate[1] + "-" + gate[2];
        } else if (output) {
          source = board.outputs[output[1]].source;
          target = "target-" + output[1];
        } else continue;
        if (edge.querySelectorAll(".signal-strand").length !== 2)
          errors.push({ name: "external connection must have two wires", id });
        for (const rail of [0, 1]) {
          const path = edge.querySelector(
            '.signal-strand[data-rail="' + rail + '"]',
          );
          checkColor("external wire phase", path, values[source], rail);
          equal(
            "external source pole",
            point(path),
            center(
              pole(
                document.querySelector('[data-testid="source-' + source + '"]'),
                rail,
              ),
            ),
          );
          equal(
            "external target pole",
            point(path, true),
            center(
              pole(
                document.querySelector('[data-testid="' + target + '"]'),
                rail,
              ),
            ),
          );
        }
      }
      return errors;
    }, values);
    assert.deepEqual(
      issues,
      [],
      "Every conductor must remain separate up to its own three-input aggregation point",
    );
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
      canvas.height > 480,
      "The circuit must use most of the viewport height",
    );
    assert.ok(
      await page.getByRole("button", { name: /次へ：AND/ }).isDisabled(),
      "The first action must be tried before advancing",
    );
    assert.equal(
      await page.locator("#lesson-panel").count(),
      0,
      "The first task must not be hidden behind a lesson panel",
    );
    assert.ok(await page.locator(".onboarding-coach").isVisible());
    await page
      .getByRole("button", { name: "入力Bを切り替える", exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector('[data-testid="status"]')
        .textContent.includes("1が2票"),
    );
    assert.ok(
      await page.getByRole("button", { name: /次へ：AND/ }).isEnabled(),
    );
    await page.screenshot({
      path: path.join(out, "intro-success-" + width + ".png"),
      fullPage: true,
    });
    const before = (await page.locator(".flow-frame").boundingBox()).width;
    await page
      .getByRole("button", { name: "説明とテスト", exact: true })
      .click();
    await page.locator("#lesson-panel").waitFor();
    if (width === 1280)
      assert.ok(
        (await page.locator(".flow-frame").boundingBox()).width < before - 250,
      );
    await page.getByRole("button", { name: "説明を畳む", exact: true }).click();
    await page.getByRole("button", { name: /次へ：AND/ }).click();
    assert.equal(await page.locator(".react-flow__node-constant").count(), 2);
    assert.equal(
      await page.locator('.react-flow__node[data-id="constants"]').count(),
      0,
    );
    await page.screenshot({
      path: path.join(out, "wire-guide-start-" + width + ".png"),
      fullPage: true,
    });
    await page.locator(".guide-source").waitFor();
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
    assert.equal(
      await page.getByRole("button", { name: /詳細/ }).count(),
      0,
      "There must be no detail mode controls",
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
      const zero = page.locator('.react-flow__node[data-id="constant:0"]');
      const one = page.locator('.react-flow__node[data-id="constant:1"]');
      const beforeZero = await zero.evaluate((node) => node.style.transform);
      const beforeOne = await one.evaluate((node) => node.style.transform);
      await zero.locator(".node-title").click();
      await zero.focus();
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(
        (previous) =>
          document.querySelector('.react-flow__node[data-id="constant:0"]')
            .style.transform !== previous,
        beforeZero,
      );
      await page.waitForFunction(
        () =>
          JSON.parse(localStorage.getItem("parametron-puzzle:v2")).boards.and
            .flow?.blueprintWide?.["constant:0"],
      );
      assert.equal(
        await one.evaluate((node) => node.style.transform),
        beforeOne,
        "Moving fixed 0 must leave fixed 1 in place",
      );
      const fixedPositions = (await stored(page)).boards.and.flow.blueprintWide;
      await page.reload({ waitUntil: "networkidle" });
      await zero.waitFor();
      await clear(page, 1);
      assert.deepEqual(
        (await stored(page)).boards.and.flow.blueprintWide,
        fixedPositions,
      );
      assert.equal(
        await one.evaluate((node) => node.style.transform),
        beforeOne,
      );
    }
    await page.screenshot({
      path: path.join(out, `and-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "クリア結果", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /次へ：OR/ })
      .click();
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
    await page.getByRole("button", { name: /次へ：平行とねじり/ }).click();
    const twist = page.getByRole("switch", {
      name: "P1の入力2を反転",
      exact: true,
    });
    assert.equal(await twist.getAttribute("aria-checked"), "false");
    if (width < 700) await twist.tap();
    else await twist.click();
    await clear(page, 1);
    assert.equal(await twist.getAttribute("aria-checked"), "true");
    await checkTerminals(page);
    const inputA = page.getByRole("button", {
      name: "入力Aを切り替える",
      exact: true,
    });
    const beforeInput = (await stored(page)).boards.twist.input;
    if (width < 700) await inputA.tap();
    else await inputA.click();
    assert.equal((await stored(page)).boards.twist.input, beforeInput ^ 2);
    await checkTerminals(page);
    if (width < 700) await inputA.tap();
    else await inputA.click();
    await checkTerminals(page);
    assert.equal(
      await page
        .locator('.parametron-lead[data-port="1"] .wire-bridge')
        .count(),
      1,
    );
    await page.screenshot({
      path: path.join(out, "twist-" + width + ".png"),
      fullPage: true,
    });
    if (width < 700) await twist.tap();
    else await twist.click();
    assert.equal(await twist.getAttribute("aria-checked"), "false");
    await checkTerminals(page);
    assert.equal(
      await page
        .locator('.parametron-lead[data-port="1"] .wire-bridge')
        .count(),
      0,
    );
    assert.equal(
      await page.getByRole("button", { name: /次へ：XOR/ }).isDisabled(),
      true,
    );
    await twist.focus();
    await page.keyboard.press("Space");
    await clear(page, 1);
    if (width === 1280) {
      await page.getByRole("button", { name: /次へ：XOR/ }).click();
      assert.equal((await stored(page)).boards.xor.gates.length, 0);
      await page.screenshot({
        path: path.join(out, "xor-empty.png"),
        fullPage: true,
      });
      await place(page);
      await page
        .getByRole("button", { name: "P1を取り外す", exact: true })
        .click();
      assert.equal(
        (await stored(page)).boards.xor.gates.length,
        0,
        "Compact nodes must have a delete button",
      );
      await place(page);
      await page.locator(".react-flow__node-gate").click();
      await page.keyboard.press("Delete");
      assert.equal(
        (await stored(page)).boards.xor.gates.length,
        0,
        "Selected nodes must also support Delete",
      );
      for (let i = 0; i < 3; i++) await place(page);
      assert.deepEqual(
        await page
          .getByRole("group", { name: "素子・ブループリントを配置" })
          .locator("button")
          .evaluateAll((buttons) =>
            buttons.map((button) => button.dataset.part),
          ),
        ["MAJ", "AND", "OR"],
      );
      assert.deepEqual(
        await page.locator(".part-palette button").allTextContents(),
        ["パラメトロン", "AND", "OR"],
        "Placement buttons must show names without element counts",
      );
      assert.equal(
        await page
          .getByRole("combobox", { name: "配置する素子・ブループリント" })
          .count(),
        0,
      );
      for (const [i, ports] of [
        ["A", "B", "0"],
        ["A", "B", "1"],
        ["!P1", "P2", "0"],
      ].entries())
        for (const [j, source] of ports.entries())
          await wire(page, i + 1, j + 1, source);
      await connect(page, "P3", "Y");
      await clear(page, 3);
      const inputInvert = page.getByRole("switch", {
        name: "P1の入力1を反転",
        exact: true,
      });
      await inputInvert.focus();
      await page.keyboard.press("Enter");
      assert.equal(
        (await stored(page)).boards.xor.gates[0].ports[0].inverted,
        true,
      );
      await page.reload({ waitUntil: "networkidle" });
      await inputInvert.waitFor();
      assert.equal(await inputInvert.getAttribute("aria-checked"), "true");
      assert.equal(
        await page.locator('[data-presentation="detail"]').count(),
        0,
      );
      await inputInvert.click();
      await clear(page, 3);
      const outputInvert = page.getByRole("switch", {
        name: "出力Yを反転",
        exact: true,
      });
      await outputInvert.click();
      assert.equal((await stored(page)).boards.xor.outputs.Y.inverted, true);
      await checkTerminals(page);
      assert.equal(await outputInvert.getAttribute("aria-checked"), "true");
      await outputInvert.focus();
      await page.keyboard.press("Space");
      await clear(page, 3);
      await page.screenshot({
        path: path.join(out, "xor.png"),
        fullPage: true,
      });
      await page.getByRole("button", { name: /次へ：半加算器/ }).click();
      assert.equal((await stored(page)).boards.half.gates.length, 0);
      await page.screenshot({
        path: path.join(out, "half-empty.png"),
        fullPage: true,
      });
      for (const name of ["XOR", "AND"]) {
        await place(page, name);
      }
      const half = (await stored(page)).boards.half;
      assert.equal(half.gates.length, 4);
      assert.equal(
        await page.locator('[data-presentation="blueprint"]').count(),
        2,
      );
      for (const [i, gate] of half.gates.entries())
        for (const [p, edge] of gate.ports.entries())
          if (edge.socket) await wire(page, i + 1, p + 1, edge.socket);
      await connect(page, "P3", "S");
      await connect(page, "P4", "C");
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
      await connect(page, "P1", "C");
      await clear(page, 3);
      assert.ok(
        minimumDialogs.has("half"),
        "Improving a normal half-adder clear to three elements must show a distinct theoretical-minimum clear",
      );
      await fit(page);
      await page
        .getByRole("button", {
          name:
            half.blueprints.find((group) => group.name === "AND").id +
            "の回路を取り外す",
          exact: true,
        })
        .click();
      assert.equal((await stored(page)).boards.half.gates.length, 3);
      await page.getByRole("button", { name: /次へ：セレクター/ }).click();
      assert.equal((await stored(page)).boards.mux.gates.length, 0);
      for (let i = 0; i < 3; i++)
        await page
          .getByRole("button", { name: "パラメトロンを配置", exact: true })
          .click();
      for (const [i, ports] of [
        ["A", "!S", "0"],
        ["B", "S", "0"],
        ["P1", "P2", "1"],
      ].entries())
        for (const [j, source] of ports.entries())
          await wire(page, i + 1, j + 1, source);
      await connect(page, "P3", "Y");
      await clear(page, 3);
      await checkTerminals(page);
      await page.screenshot({
        path: path.join(out, "selector.png"),
        fullPage: true,
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
      await checkTerminals(page);
      await fit(page);
      await page.screenshot({
        path: path.join(out, "full-adder.png"),
        fullPage: true,
      });
      const title = page.locator(
        '.react-flow__node[data-id="gate:0"] .node-title',
      );
      const before = await title.boundingBox();
      await page.mouse.move(
        before.x + before.width * 0.2,
        before.y + before.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        before.x + before.width * 0.2 + 60,
        before.y + before.height / 2 + 40,
        { steps: 8 },
      );
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
      await page.mouse.move(groupBox.x + 15, groupBox.y + groupBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        groupBox.x + 55,
        groupBox.y + groupBox.height / 2 + 32,
        { steps: 8 },
      );
      await page.mouse.up();
      for (const id of ["bp5", "bp4", "bp3", "bp2", "bp1"]) {
        await fit(page);
        await page
          .getByRole("button", { name: id + "の回路を取り外す", exact: true })
          .click();
      }
      assert.equal((await stored(page)).boards.full.gates.length, 0);
      for (const [name, bit] of [
        ["AND", "0"],
        ["OR", "1"],
      ]) {
        await page
          .getByRole("button", { name: name + "を配置", exact: true })
          .click();
        const preset = (await stored(page)).boards.full;
        assert.equal(preset.gates.length, 1);
        assert.equal(preset.gates[0].type, "MAJ");
        assert.equal(preset.gates[0].ports[2].source, bit);
        assert.equal(preset.gates[0].ports[2].fixed, true);
        await page.getByText("固定" + bit, { exact: true }).waitFor();
        assert.equal(
          await page.locator('.react-flow__edge[data-id="gate:0:2"]').count(),
          0,
          "Preset constants must not create external cables",
        );
        await page.reload({ waitUntil: "networkidle" });
        assert.equal(
          (await stored(page)).boards.full.gates[0].ports[2].fixed,
          true,
        );
        await fit(page);
        await page.screenshot({
          path: path.join(out, name.toLowerCase() + "-preset.png"),
          fullPage: true,
        });
        await page
          .getByRole("button", {
            name: preset.blueprints[0].id + "の回路を取り外す",
            exact: true,
          })
          .click();
      }
      // A palette entry stamps a saved raw circuit, with constants and inversions.
      await page
        .getByRole("button", { name: "XORを配置", exact: true })
        .click();
      const stamp = (await stored(page)).boards.full;
      assert.equal(stamp.gates.length, 3);
      assert.ok(stamp.gates.every((gate) => gate.type === "MAJ"));
      assert.equal(stamp.gates[2].ports[0].inverted, true);
      await page.locator('[data-presentation="blueprint"]').waitFor();
      await fit(page);
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
      for (let i = 0; i < 3; i++)
        await page
          .getByRole("button", { name: "パラメトロンを配置", exact: true })
          .click();
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
      const beforeReplay = await stored(page);
      await page
        .getByRole("combobox", { name: "問題を選ぶ" })
        .selectOption("0");
      await page
        .getByRole("button", { name: "回路で試す", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "練習を閉じてゲームに戻る", exact: true })
        .click();
      const afterReplay = await stored(page);
      assert.equal(afterReplay.levelId, "full");
      assert.deepEqual(
        afterReplay.boards.full,
        beforeReplay.boards.full,
        "Opening the introduction must preserve the current circuit",
      );
      assert.deepEqual(afterReplay.bests, beforeReplay.bests);
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
      fixture.level = 6;
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
        .getByRole("button", { name: "XORを配置", exact: true })
        .tap();
      await mobile.page.locator('[data-presentation="blueprint"]').waitFor();
      assert.equal((await stored(mobile.page)).boards.full.gates.length, 3);
      await connect(mobile.page, "A", "0-0", true);
      assert.equal(
        (await stored(mobile.page)).boards.full.gates[0].ports[0].source,
        "A",
      );
      const invert = mobile.page.getByRole("switch", {
        name: "P1の入力1を反転",
        exact: true,
      });
      await invert.tap();
      assert.equal(
        (await stored(mobile.page)).boards.full.gates[0].ports[0].inverted,
        true,
      );
      await invert.tap();
      assert.equal(
        (await stored(mobile.page)).boards.full.gates[0].ports[0].inverted,
        false,
      );
      const output = mobile.page.getByRole("switch", {
        name: "出力Sを反転",
        exact: true,
      });
      await output.tap();
      assert.equal(
        (await stored(mobile.page)).boards.full.outputs.S.inverted,
        true,
      );
      await output.tap();
      assert.equal(
        (await stored(mobile.page)).boards.full.outputs.S.inverted,
        false,
      );
      assert.equal(
        await mobile.page.locator('[data-presentation="detail"]').count(),
        0,
      );
      await mobile.page.screenshot({
        path: path.join(out, `blueprint-${width}.png`),
        fullPage: true,
      });
      await mobile.context.close();
    }
  }
  await browser.close();
  assert.deepEqual(
    [...clearedDialogs].sort(),
    ["and", "full", "half", "mux", "or", "twist", "xor"],
    "Every puzzle must present its clear dialog",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: React Flow native drag/click/tap connections, node and keyboard movement, saved progress/positions, Dagre layout, raw parametron blueprint placement/ungrouping/removal, 9- and 3-element full adders, reversed creation order, cycle rejection, responsive pages.",
  );
})().catch(async (error) => {
  console.error(error);
  await browser?.close();
  process.exitCode = 1;
});
