export function renderTable({ columns, rows, emptyMessage = 'Nenhum registro encontrado.' }) {
  if (!rows || !rows.length) {
    return `<div class="empty-state">${emptyMessage}</div>`;
  }

  const headers = columns.map((col) => `<th>${col.label}</th>`).join('');

  const body = rows.map((row) => {
    const cells = columns.map((col) => {
      const value = col.render ? col.render(row) : (row[col.key] ?? '—');
      return `<td data-label="${col.label}">${value}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `
    <div class="table-wrap">
      <table class="table-area">
        <thead><tr>${headers}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}
