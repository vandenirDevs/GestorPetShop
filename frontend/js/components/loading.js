export function renderLoading(message = 'Carregando...') {
  return `
    <div class="loading-box">
      <span class="spinner"></span>
      <span>${message}</span>
    </div>
  `;
}
