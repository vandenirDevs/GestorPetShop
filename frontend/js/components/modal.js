export function openModal(title, bodyHtml, footerHtml = '', options = {}) {
  const root = document.getElementById('modal-root');
  if (!root) return null;

  const modalOptions = {
    confirmOnClose: false,
    confirmTitle: 'Tem certeza que deseja cancelar o cadastro?',
    confirmYesLabel: 'Sim, cancelar',
    confirmNoLabel: 'Não, continuar',
    ...options
  };

  const buildModal = () => `
    <div class="modal-backdrop open">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3>${title}</h3>
          <button type="button" class="btn ghost" data-close-modal>Fechar</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        <div class="modal-footer">${footerHtml}</div>
      </div>
    </div>
  `;

  const buildConfirmation = () => `
    <div class="modal-confirmation" data-confirm-panel style="position:absolute; inset:0; background: rgba(15, 23, 42, 0.55); display:flex; align-items:center; justify-content:center; z-index:10; border-radius: 18px;">
      <div class="modal" role="dialog" aria-modal="true" style="width:min(420px, calc(100% - 2rem)); margin:0; box-shadow:0 16px 40px rgba(15, 23, 42, 0.28);">
        <div class="modal-header">
          <h3>${modalOptions.confirmTitle}</h3>
        </div>
        <div class="modal-body">
          <p>Deseja realmente cancelar este cadastro? Os dados preenchidos serão descartados.</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn ghost" data-confirm-cancel="no">${modalOptions.confirmNoLabel}</button>
          <button type="button" class="btn danger" data-confirm-cancel="yes">${modalOptions.confirmYesLabel}</button>
        </div>
      </div>
    </div>
  `;

  const bindModalEvents = () => {
    root.querySelectorAll('[data-close-modal]').forEach((closeBtn) => {
      closeBtn.addEventListener('click', () => {
        if (modalOptions.confirmOnClose) {
          const modal = root.querySelector('.modal');
          if (!modal || modal.querySelector('[data-confirm-panel]')) return;
          modal.style.position = 'relative';
          modal.insertAdjacentHTML('beforeend', buildConfirmation());

          const confirmation = modal.querySelector('[data-confirm-panel]');
          confirmation?.querySelector('[data-confirm-cancel="no"]')?.addEventListener('click', () => {
            confirmation.remove();
          });

          confirmation?.querySelector('[data-confirm-cancel="yes"]')?.addEventListener('click', () => {
            closeModal();
          });
          return;
        }

        closeModal();
      });
    });

    root.querySelector('.modal-backdrop')?.addEventListener('click', (event) => {
      if (!event.target.classList.contains('modal-backdrop')) {
        return;
      }

      if (modalOptions.confirmOnClose) {
        const modal = root.querySelector('.modal');
        if (!modal || modal.querySelector('[data-confirm-panel]')) return;
        modal.style.position = 'relative';
        modal.insertAdjacentHTML('beforeend', buildConfirmation());

        const confirmation = modal.querySelector('[data-confirm-panel]');
        confirmation?.querySelector('[data-confirm-cancel="no"]')?.addEventListener('click', () => {
          confirmation.remove();
        });

        confirmation?.querySelector('[data-confirm-cancel="yes"]')?.addEventListener('click', () => {
          closeModal();
        });
        return;
      }

      closeModal();
    });
  };

  root.innerHTML = buildModal();
  bindModalEvents();

  return root;
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
}
