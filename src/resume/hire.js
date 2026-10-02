import { nextChapter } from "../content.js";

// ben.hire() lands here (resume.html?hire): an email to me, already
// written, typed out in front of you. Send it from your own email app or
// Gmail, or copy it. Nothing is sent from this page.

const SUBJECT = "Ben, we need to talk";
const BODY = `Ben,

I'll be brief, because time is short.

I opened the developer console on your website. I typed a command. And now, somehow, I'm writing this email.

I have seen the strings. I have watched the page do a barrel roll. I've read your résumé, and I can't stop thinking about the 82%.

My team needs someone like you. Possibly you, specifically.

Reply when you can. Sooner is better. Now would be ideal.

With great urgency,
[Your name]
[Your company]`;

export function showHireDraft() {
  history.replaceState(null, "", location.pathname);
  const box = document.createElement("div");
  box.className = "hire";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Email draft");
  box.innerHTML = `
    <div class="hire__card">
      <header class="hire__head">
        <p>New message</p>
        <button type="button" class="hire__close" aria-label="Close">×</button>
      </header>
      <p class="hire__row"><span>To</span>${nextChapter.email}</p>
      <p class="hire__row"><span>Subject</span>${SUBJECT}</p>
      <textarea class="hire__body" spellcheck="false" aria-label="Message"></textarea>
      <div class="hire__actions">
        <a class="hire__btn hire__btn--primary" data-mail>Open in my email app</a>
        <a class="hire__btn" data-gmail target="_blank" rel="noopener">Open in Gmail</a>
        <button type="button" class="hire__btn" data-copy>Copy</button>
      </div>
    </div>`;
  document.body.appendChild(box);
  requestAnimationFrame(() => box.classList.add("is-on"));

  const body = box.querySelector(".hire__body");
  const mail = box.querySelector("[data-mail]");
  const gmail = box.querySelector("[data-gmail]");
  const sync = () => {
    const text = body.value;
    mail.href = `mailto:${nextChapter.email}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(text)}`;
    gmail.href = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(nextChapter.email)}&su=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(text)}`;
  };

  // typed out, quickly, a few characters a frame
  let n = 0;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const type = () => {
    n = reduced ? BODY.length : Math.min(BODY.length, n + 3);
    body.value = BODY.slice(0, n);
    body.scrollTop = body.scrollHeight;
    sync();
    if (n < BODY.length) requestAnimationFrame(type);
  };
  setTimeout(type, 400);
  body.addEventListener("input", () => {
    n = BODY.length; // they've started editing: stop typing
    sync();
  });

  const close = () => {
    box.classList.remove("is-on");
    setTimeout(() => box.remove(), 300);
  };
  box.querySelector(".hire__close").addEventListener("click", close);
  box.addEventListener("click", (e) => e.target === box && close());
  document.addEventListener("keydown", (e) => e.key === "Escape" && close());
  box.querySelector("[data-copy]").addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText(`To: ${nextChapter.email}\nSubject: ${SUBJECT}\n\n${body.value}`);
      e.target.textContent = "Copied";
    } catch {
      body.select();
      e.target.textContent = "Press Ctrl+C";
    }
  });
}
