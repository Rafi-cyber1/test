type PrintTarget = 'receipt' | 'member-card' | 'report' | 'inventory-receipt' | 'fee-record';

export const printDocument = async (target: PrintTarget): Promise<void> => {
  document.documentElement.dataset.printTarget = target;
  try {
    const desktopStorage = (window as Window & {
      gymTownStorage?: { print?: () => Promise<void> };
    }).gymTownStorage;
    if (desktopStorage?.print) {
      await desktopStorage.print();
    } else {
      window.print();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to open the print dialog.';
    window.alert(`Printing failed: ${message}`);
  } finally {
    delete document.documentElement.dataset.printTarget;
  }
};
