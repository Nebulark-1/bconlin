import { createBlueprint } from "../blueprint.js";
import { createInspector } from "./inspector.js";
import { secretsTopic, secretsChip } from "./topics-eggs.js";
import { onEggs } from "../site/eggs.js";
import { setTone } from "../site/sound.js";

/**
 * "Behind the scenes" for a page without a scene of its own (the résumé,
 * projects and secrets pages): the switch, the inspector with this page's
 * topics (plus the secrets you've found), and a small live readout.
 *
 * fab:    what mountFab({ blueprint: true }) returned
 * topics: this page's inspector topics
 * stats:  what the topics read (getters are fine, so they stay live)
 * hud:    () => lines for the readout in the corner
 */
export function mountBehind(fab, topics, stats, hud = () => []) {
  const host = document.createElement("div");
  host.className = "bp-host";
  host.innerHTML = `<pre class="bp-hud" aria-hidden="true"></pre>`;
  document.body.appendChild(host);
  const readout = host.querySelector(".bp-hud");

  const blueprint = createBlueprint(fab.blueprintButton);
  const inspector = createInspector(host, [...topics, secretsTopic(stats)], { stats });
  onEggs(() => {
    const chip = host.querySelector('.bp-chips button[data-topic="secrets"]');
    if (chip) chip.textContent = secretsChip();
  });

  // only spend frames on it while it's showing
  let raf = 0;
  const frame = (now) => {
    readout.textContent = hud().join("\n");
    inspector.frame(now / 1000);
    raf = requestAnimationFrame(frame);
  };
  blueprint.subscribe((on) => {
    setTone(on);
    cancelAnimationFrame(raf);
    if (on) raf = requestAnimationFrame(frame);
    else inspector.close();
  });
  return { blueprint, inspector };
}
