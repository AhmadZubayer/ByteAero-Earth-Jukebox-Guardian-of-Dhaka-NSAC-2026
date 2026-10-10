/* Earth Jukebox — team member slots for s02, filled from js/content.js "members".
 * Empty name/role values render as clearly labelled preview placeholders (never invented). */
(function () {
  var host = document.getElementById("members"); if (!host) return;
  var list = window.EJ_CONTENT.members || [];
  var esc = function (v) { return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;"); };
  host.innerHTML = list.map(function (m, i) {
    var pending = !m.name || !m.role;
    return '<div class="member a in-pop' + (pending ? " pending" : "") + '" style="--d:' + (30 + i * 0.3125) +
      ';left:' + (i % 2) * 384 + 'px;top:' + Math.floor(i / 2) * 212 + 'px">' +
      '<div class="note">MEMBER ' + String(i + 1).padStart(2, "0") + '</div>' +
      '<div class="mname">' + (m.name ? esc(m.name) : "Name pending") + '</div>' +
      '<div class="mrole">' + (m.role ? esc(m.role) : "Role pending") + '</div>' +
      (pending ? '<span class="tag slot">Preview slot</span>' : '') + '</div>';
  }).join("");
})();
