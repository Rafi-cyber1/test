type PrintTarget = 'receipt' | 'member-card' | 'report' | 'inventory-receipt' | 'fee-record';

export const printDocument = async (target: PrintTarget): Promise<void> => {
  document.documentElement.dataset.printTarget = target;
  try {
    const browserPrint = () => {
      if (typeof window.print !== 'function') {
        throw new Error('Printing is unavailable in this browser or desktop environment.');
      }
      window.print();
    };
    const desktopStorage = (window as Window & {
      gymTownStorage?: { print?: () => Promise<void> };
    }).gymTownStorage;
    if (desktopStorage?.print) {
      try {
        await desktopStorage.print();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/printing is not supported/i.test(message)) throw error;
        browserPrint();
      }
    } else {
      browserPrint();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to open the print dialog.';
    window.alert(`Printing failed: ${message}`);
  } finally {
    delete document.documentElement.dataset.printTarget;
  }
};
