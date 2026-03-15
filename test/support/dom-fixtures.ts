/** Returns the anonymous legacy header markup used on logged-out pages. */
export function anonymousHeaderHtml() {
  return `
    <nav class="navbar">
      <ul class="navbar-right">
        <li><a href="/login">ログイン</a></li>
      </ul>
    </nav>
  `;
}

/** Returns the authenticated legacy header markup used on contest pages. */
export function authenticatedHeaderHtml(userHandle = "tourist") {
  return `
    <nav class="navbar">
      <ul class="navbar-right">
        <li class="dropdown">
          <a class="dropdown-toggle">${userHandle}</a>
          <ul class="dropdown-menu">
            <li><a href="/users/${userHandle}">プロフィール</a></li>
          </ul>
        </li>
      </ul>
    </nav>
  `;
}

/** Returns the authenticated top-page header markup. */
export function topPageHeaderHtml(userHandle = "tourist") {
  return `
    <header id="header">
      <div class="header-mypage">
        <button class="j-dropdown_mypage">${userHandle}</button>
      </div>
      <div class="header-mypage_detail">
        <ul class="header-mypage_list">
          <li><a href="/users/${userHandle}">プロフィール</a></li>
        </ul>
      </div>
    </header>
  `;
}

/** Returns a problem-page heading block with an optional commentary link. */
export function problemHeadingHtml(
  title = "D - Coming of Age Celebration",
  withCommentaryLink = false,
) {
  return `
    <div class="col-sm-12">
      <span class="h2">
        ${title}
        ${withCommentaryLink ? '<a class="btn btn-default btn-sm">解説</a>' : ""}
      </span>
    </div>
  `;
}

/** Returns a legacy authenticated problem page with the given heading title. */
export function authenticatedProblemPageHtml(
  title = "A - Happy Birthday!",
  userHandle = "tourist",
) {
  return `
    ${authenticatedHeaderHtml(userHandle)}
    <div class="col-sm-12">
      <span class="h2">${title}</span>
    </div>
  `;
}

/** Returns a submission detail block with a canonical task link row. */
export function submissionDetailHtml(title = "D - Coming of Age Celebration") {
  return `
    <div class="col-sm-12">
      <p><span class="h2">提出 #61566375</span></p>
      <table class="table table-bordered">
        <tbody>
          <tr>
            <th>問題</th>
            <td>
              <a href="/contests/abc388/tasks/abc388_d">${title}</a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}
