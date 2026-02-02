document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const inputs = {
    dataInput: $("dataInput"),
    qrStyle: $("qrStyle"),
    fgColor: $("fgColor"),
    bgColor: $("bgColor"),
    bgTransparent: $("bgTransparent"),
    logoInput: $("logoInput"),
    generateBtn: $("generateBtn"),
    resetBtn: $("resetBtn"),
    pngBtn: $("pngBtn"),
    svgBtn: $("svgBtn"),
    wifiSsid: $("wifiSsid"),
    wifiPassword: $("wifiPassword"),
  };

  const qrHost = $("qrCanvas");
  const contentHint = $("contentGuard");
  const previewCard = document.querySelector(".preview-card");

  const contentModeRadios = document.querySelectorAll('input[name="contentMode"]');
  const contentSections = {
    text: $("textFields"),
    wifi: $("wifiFields"),
  };
  const wifiPasswordToggle = $("wifiPasswordToggle");

  const QUIET_ZONE_PX = 17;
  const LOGO_RADIUS_PX = 40;
  const LOGO_BORDER_PX = 8;
  const DATA_MAX_CHARS = 500;

  const state = {
    logoImage: null,
    mode: "text",
  };

  if (!qrHost) {
    console.warn("QR host element #qrCanvas not found");
    return;
  }

  let qr = null;

  function createQR() {
    const instance = new QRCodeStyling({
      width: 1668,
      height: 1668,
      type: "canvas",
      data: " ",
      margin: QUIET_ZONE_PX,
      qrOptions: { errorCorrectionLevel: "H" },
      dotsOptions: { color: "#111827", type: "square" },
      cornersSquareOptions: { color: "#111827", type: "square" },
      cornersDotOptions: { color: "#111827", type: "square" },
      backgroundOptions: { color: "#ffffff" },
    });

    instance.append(qrHost);
    return instance;
  }

  function ensureQRInstance() {
    if (qr) return;
    qrHost.innerHTML = "";
    qr = createQR();
  }

  function enforceTextLimit() {
    if (!inputs.dataInput) return;
    inputs.dataInput.maxLength = DATA_MAX_CHARS;
    inputs.dataInput.value = inputs.dataInput.value.slice(0, DATA_MAX_CHARS);
  }

  function getContentValue() {
    return (inputs.dataInput?.value || "").trim();
  }

  function escapeWifiValue(val) {
    return (val || "").replace(/([\\;,:])/g, "\\$1");
  }

  function buildWifiPayload() {
    const ssid = (inputs.wifiSsid?.value || "").trim() || "MyWiFi";
    const password = inputs.wifiPassword?.value || "";
    const auth = password ? "WPA" : "nopass";
    const ssidEsc = escapeWifiValue(ssid);
    const passEsc = escapeWifiValue(password);
    const passPart = password ? `P:${passEsc};` : "";
    return `WIFI:T:${auth};S:${ssidEsc};${passPart};`;
  }

  function hasContent() {
    if (state.mode === "wifi") {
      return (inputs.wifiSsid?.value || "").trim().length > 0;
    }
    return getContentValue().length > 0;
  }

  function syncButtons() {
    const enabled = hasContent();
    inputs.generateBtn.disabled = !enabled;
    inputs.pngBtn.disabled = !enabled;
    inputs.svgBtn.disabled = !enabled;

    inputs.generateBtn.setAttribute("aria-disabled", String(!enabled));
    if (contentHint) contentHint.classList.toggle("hidden", enabled);
  }

  function setWifiPasswordVisible(isVisible) {
    const show = Boolean(isVisible);
    if (inputs.wifiPassword) inputs.wifiPassword.type = show ? "text" : "password";

    if (wifiPasswordToggle) {
      wifiPasswordToggle.dataset.visible = String(show);
      wifiPasswordToggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
      wifiPasswordToggle.setAttribute("title", show ? "Hide password" : "Show password");
      wifiPasswordToggle.classList.toggle("active", show);
    }
  }

  function attachPasswordPeek(btn) {
    if (!btn) return;

    const show = () => setWifiPasswordVisible(true);
    const hide = () => setWifiPasswordVisible(false);

    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
      show();
    });

    ["pointerup", "pointercancel", "pointerleave"].forEach((evt) => {
      btn.addEventListener(evt, hide);
    });

    btn.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        show();
      }
    });

    btn.addEventListener("keyup", hide);
  }

  attachPasswordPeek(wifiPasswordToggle);

  function setContentMode(mode) {
    state.mode = mode === "wifi" ? "wifi" : "text";

    Object.entries(contentSections).forEach(([key, el]) => {
      if (!el) return;
      const active = key === state.mode;
      el.classList.toggle("hidden", !active);
      el.setAttribute("aria-hidden", String(!active));
    });

    contentModeRadios.forEach((radio) => {
      const active = radio.value === state.mode;
      radio.checked = active;
      const pill = radio.closest(".pill");
      if (pill) pill.classList.toggle("active", active);
    });

    enforceTextLimit();
    syncButtons();
  }

  function getStyleSelection() {
    const opt = inputs.qrStyle?.selectedOptions?.[0];
    return {
      dotType: opt?.value || "square",
      finderBase: opt?.dataset?.finder || "square",
    };
  }

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function buildLogoAsset(targetLogoPx, shape, radiusPx, borderPx, borderColor) {
    if (!state.logoImage) return null;

    const canvasSize = 512;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = canvasSize;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    const img = state.logoImage;
    const scale = Math.min(canvasSize / img.width, canvasSize / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const dx = (canvasSize - drawW) / 2;
    const dy = (canvasSize - drawH) / 2;

    const safeTarget = Math.max(targetLogoPx, 1);
    const borderCanvas = Math.max(0, (Number(borderPx) || 0) / safeTarget) * canvasSize;

    ctx.save();
    ctx.fillStyle = borderColor || "#ffffff";

    if (shape === "circle") {
      const cx = canvasSize / 2;
      const cy = canvasSize / 2;
      const r = Math.min(canvasSize / 2, Math.max(drawW, drawH) / 2 + borderCanvas);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    } else {
      const plateX = dx - borderCanvas;
      const plateY = dy - borderCanvas;
      const plateW = drawW + borderCanvas * 2;
      const plateH = drawH + borderCanvas * 2;

      const baseRadius =
        shape === "rounded"
          ? Math.min(canvasSize / 2, (radiusPx / safeTarget) * canvasSize)
          : 0;

      roundRect(ctx, plateX, plateY, plateW, plateH, shape === "rounded" ? baseRadius : 0);
      ctx.fill();
    }

    ctx.restore();

    ctx.save();

    if (shape === "circle") {
      const r = canvasSize / 2;
      ctx.beginPath();
      ctx.arc(r, r, r - borderCanvas, 0, Math.PI * 2);
      ctx.closePath();
    } else {
      const radius =
        shape === "rounded"
          ? Math.min(canvasSize / 2, (radiusPx / safeTarget) * canvasSize)
          : 0;
      roundRect(ctx, dx, dy, drawW, drawH, radius);
    }

    ctx.clip();
    ctx.drawImage(img, dx, dy, drawW, drawH);
    ctx.restore();

    return canvas.toDataURL("image/png");
  }

  function buildOptions() {
    const size = 1668;
    const withLogo = Boolean(state.logoImage);

    const fg = inputs.fgColor?.value || "#111827";
    const bg = inputs.bgTransparent?.checked
      ? "rgba(255,255,255,0)"
      : inputs.bgColor?.value || "#ffffff";

    const { dotType, finderBase } = getStyleSelection();

    const data =
      state.mode === "wifi"
        ? buildWifiPayload()
        : getContentValue().slice(0, DATA_MAX_CHARS);

    const base = {
      width: size,
      height: size,
      data,
      margin: QUIET_ZONE_PX,
      qrOptions: { errorCorrectionLevel: "H" },
      dotsOptions: { type: dotType, color: fg },
      backgroundOptions: { color: bg },
      cornersSquareOptions: { type: finderBase, color: fg },
      cornersDotOptions: { type: finderBase, color: fg },
    };

    if (!withLogo) return base;

    const logoScale = 35;
    const logoSizePct = logoScale / 100;
    const targetLogoPx = size * logoSizePct;

    const processedLogo = buildLogoAsset(
      targetLogoPx,
      "rounded",
      LOGO_RADIUS_PX,
      LOGO_BORDER_PX,
      inputs.bgTransparent?.checked ? "#ffffff" : inputs.bgColor?.value || "#ffffff"
    );

    return {
      ...base,
      image: processedLogo || undefined,
      imageOptions: {
        imageSize: logoSizePct,
        margin: Math.min(24, Math.max(0, Math.round((logoScale * 6) / 18))) + LOGO_BORDER_PX,
        crossOrigin: "anonymous",
        hideBackgroundDots: true,
      },
    };
  }

  function renderQR() {
    if (!hasContent()) return;
    ensureQRInstance();
    const opts = buildOptions();
    qr.update(opts);
  }

  function resetForm() {
    if (inputs.dataInput) inputs.dataInput.value = "";
    if (inputs.qrStyle) inputs.qrStyle.value = "square";
    if (inputs.fgColor) inputs.fgColor.value = "#111827";
    if (inputs.bgColor) inputs.bgColor.value = "#ffffff";
    if (inputs.bgTransparent) inputs.bgTransparent.checked = false;

    if (inputs.logoInput) inputs.logoInput.value = "";
    if (inputs.wifiSsid) inputs.wifiSsid.value = "";
    if (inputs.wifiPassword) inputs.wifiPassword.value = "";

    state.logoImage = null;

    if (inputs.bgColor) inputs.bgColor.disabled = false;

    setContentMode("text");
    setWifiPasswordVisible(false);

    qrHost.innerHTML = "";
    qr = null;

    syncButtons();
  }

  if (inputs.dataInput) {
    ["input", "change"].forEach((evt) => {
      inputs.dataInput.addEventListener(evt, () => {
        enforceTextLimit();
        syncButtons();
      });
    });
    enforceTextLimit();
  }

  if (inputs.wifiSsid) {
    ["input", "change"].forEach((evt) => {
      inputs.wifiSsid.addEventListener(evt, syncButtons);
    });
  }

  if (inputs.wifiPassword) {
    ["input", "change"].forEach((evt) => {
      inputs.wifiPassword.addEventListener(evt, syncButtons);
    });
  }

  if (inputs.bgTransparent) {
    inputs.bgTransparent.addEventListener("change", () => {
      const disabled = inputs.bgTransparent.checked;
      if (inputs.bgColor) inputs.bgColor.disabled = disabled;
    });
  }

  const bgHint = document.getElementById('bgHint');

if (inputs.bgTransparent) {
  inputs.bgTransparent.addEventListener('change', () => {
    const show = inputs.bgTransparent.checked;
    bgHint.classList.toggle('hidden', !show);
    if (show) {
      // restart the animation by removing and re-adding the class
      bgHint.classList.remove('highlight');
      void bgHint.offsetWidth; // force reflow to restart CSS animation
      bgHint.classList.add('highlight');
    }
  });
}

  contentModeRadios.forEach((radio) => {
    radio.addEventListener("change", () => setContentMode(radio.value));
  });

  if (inputs.logoInput) {
    inputs.logoInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];

      if (!file) {
        state.logoImage = null;
        return;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = String(evt.target?.result || "");
        if (!dataUrl) return;

        const img = new Image();
        img.onload = () => {
          state.logoImage = img;
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  inputs.generateBtn.addEventListener("click", (e) => {
    e.preventDefault();

    if (!hasContent()) {
      syncButtons();
      return;
    }

    renderQR();

    if (window.matchMedia("(max-width: 720px)").matches && previewCard) {
      previewCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  inputs.resetBtn.addEventListener("click", (e) => {
    e.preventDefault();
    resetForm();
  });

  function download(extension) {
    if (!hasContent()) {
      syncButtons();
      return;
    }

    renderQR();
    if (!qr) return;

    qr.download({ extension, name: "qr-code" });
  }

  inputs.pngBtn.addEventListener("click", () => download("png"));
  inputs.svgBtn.addEventListener("click", () => download("svg"));

  setContentMode("text");
  setWifiPasswordVisible(false);
  syncButtons();
});