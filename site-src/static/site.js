playHeroVideoOnlyWhileVisible();
bindAuthorEmail();
hideMissingAuthorPhoto();

function playHeroVideoOnlyWhileVisible() {
  const heroVideo = document.querySelector(".hero-video");
  if (!heroVideo) return;
  const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    heroVideo.pause();
    heroVideo.removeAttribute("autoplay");
    return;
  }
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) heroVideo.play().catch(() => {});
    else heroVideo.pause();
  }).observe(heroVideo);
}

function bindAuthorEmail() {
  for (const emailButton of document.querySelectorAll(".author-email")) {
    const { emailUser, emailDomain } = emailButton.dataset;
    const emailText = emailButton.querySelector(".author-email-text");
    if (emailText) emailText.textContent = maskEmail(emailUser, emailDomain);
    emailButton.addEventListener("click", () => {
      window.location.href = `mailto:${emailUser}@${emailDomain}`;
    });
  }
}

function maskEmail(user, domain) {
  const VISIBLE_CHARACTERS = 2;
  const MASK = "•••";
  const topLevelStart = domain.lastIndexOf(".");
  const domainName = topLevelStart > 0 ? domain.slice(0, topLevelStart) : domain;
  const topLevel = topLevelStart > 0 ? domain.slice(topLevelStart) : "";
  return `${user.slice(0, VISIBLE_CHARACTERS)}${MASK}@${domainName.slice(0, VISIBLE_CHARACTERS)}${MASK}${topLevel}`;
}

function hideMissingAuthorPhoto() {
  const photo = document.querySelector(".author-photo img");
  if (!photo) return;
  const removePhoto = () => photo.remove();
  if (photo.complete && photo.naturalWidth === 0) removePhoto();
  else photo.addEventListener("error", removePhoto);
}
