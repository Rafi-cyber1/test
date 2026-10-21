import { expect, test, type Page } from '@playwright/test';

type BrowserHealth = {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  badResponses: string[];
};

const healthByPage = new WeakMap<Page, BrowserHealth>();

test.beforeEach(async ({ page, baseURL }) => {
  const health: BrowserHealth = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    badResponses: [],
  };
  healthByPage.set(page, health);

  page.on('console', (message) => {
    if (message.type() === 'error') health.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => health.pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    if (request.url().startsWith(baseURL || '')) {
      health.failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`);
    }
  });
  page.on('response', (response) => {
    if (response.url().startsWith(baseURL || '') && response.status() >= 400) {
      health.badResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.addInitScript(() => {
    if (!sessionStorage.getItem('__playwright_initialized')) {
      localStorage.clear();
      sessionStorage.setItem('__playwright_initialized', 'true');
    }
    (window as Window & { __printCalls?: number }).__printCalls = 0;
    (window as Window & { __openedUrl?: string }).__openedUrl = '';
    window.print = () => {
      const target = window as Window & { __printCalls?: number };
      target.__printCalls = (target.__printCalls || 0) + 1;
    };
    window.open = (url) => {
      (window as Window & { __openedUrl?: string }).__openedUrl = String(url || '');
      return null;
    };
  });

  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Member Directory' })).toBeVisible();
  await expect(page.locator('header img[alt="The Gym Town"]')).toHaveAttribute('src', '/logo.png');
});

test.afterEach(async ({ page }) => {
  const health = healthByPage.get(page);
  expect(health?.consoleErrors, 'browser console errors').toEqual([]);
  expect(health?.pageErrors, 'uncaught JavaScript exceptions').toEqual([]);
  expect(health?.failedRequests, 'failed same-origin requests').toEqual([]);
  expect(health?.badResponses, 'same-origin HTTP errors').toEqual([]);
});

async function openEnrollment(page: Page) {
  await page.getByRole('button', { name: 'Member Directory' }).click();
  await page.getByRole('button', { name: 'Enroll Member' }).click();
  await expect(page.getByLabel('Member Unique ID / Roll # *')).toBeVisible();
}

async function enrollMember(page: Page, name: string, phone: string, paidAmount: number): Promise<void> {
  await openEnrollment(page);
  await page.getByLabel('Full Name *').fill(name);
  await page.getByLabel('Mobile (WhatsApp) *').fill(phone);
  await page.getByLabel('Blood Group *').selectOption('O+');
  await page.getByLabel('Amount Received *').fill(String(paidAmount));
  await page.getByRole('button', { name: 'Register & Enroll Member' }).click();
  await expect(page.getByText(/Receipt Issued:/)).toBeVisible();
}

test('enrollment validates blood group and phone; roll number, directory, and receipt persist', async ({ page }) => {
  await openEnrollment(page);
  const rollNumber = page.getByLabel('Member Unique ID / Roll # *');
  await expect(rollNumber).toHaveValue('the-gym-town-01');

  await page.getByLabel('Full Name *').fill('QA Blood Member');
  await page.getByLabel('Mobile (WhatsApp) *').fill('03001234567');
  await expect(page.getByLabel('Blood Group *')).toHaveAttribute('required', '');
  expect(await page.locator('form').last().evaluate((form) => (form as HTMLFormElement).checkValidity())).toBe(false);

  await page.getByLabel('Mobile (WhatsApp) *').fill('123');
  await page.getByLabel('Blood Group *').selectOption('A+');
  await page.getByRole('button', { name: 'Register & Enroll Member' }).click();
  await expect(page.getByRole('alert')).toContainText('11-digit phone number');

  await page.getByLabel('Mobile (WhatsApp) *').fill('03001234567');
  await page.getByRole('button', { name: 'Register & Enroll Member' }).click();

  await expect(page.getByText(/Receipt Issued:/)).toBeVisible();
  await expect(page.locator('.print-receipt')).toContainText('QA Blood Member');
  await expect(page.locator('.print-receipt')).toContainText('the-gym-town-01');
  await expect(page.locator('.print-receipt')).toContainText('Membership fees are non-refundable.');
  await expect(page.locator('.print-receipt')).toContainText('CASH ONLY');
  await expect.poll(() => page.evaluate(() => (window as Window & { __printCalls?: number }).__printCalls))
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Close receipt' }).click();

  await page.getByRole('button', { name: 'Blood Group Directory' }).click();
  await expect(page.getByRole('heading', { name: 'Blood Group Directory', exact: true })).toBeVisible();
  await expect(page.getByText('QA Blood Member')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Call QA Blood Member' })).toHaveAttribute('href', 'tel:03001234567');
  await expect(page.getByRole('link', { name: 'WhatsApp QA Blood Member' })).toHaveAttribute(
    'href',
    /https:\/\/wa\.me\/923001234567/
  );
  await page.getByLabel('Filter by blood group').selectOption('O-');
  await expect(page.getByText('No members match this blood group and search.')).toBeVisible();
  await page.getByLabel('Filter by blood group').selectOption('A+');
  await expect(page.getByText('QA Blood Member')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Blood Group Directory' }).click();
  await expect(page.getByText('QA Blood Member')).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tgt_db_data') || '{}').members?.length))
    .toBe(1);
});

test('blood directory handles empty groups and an empty member list', async ({ page }) => {
  await page.getByRole('button', { name: 'Blood Group Directory' }).click();
  await expect(page.getByRole('heading', { name: 'Blood Group Directory', exact: true })).toBeVisible();
  await expect(page.getByText('No members match this blood group and search.')).toBeVisible();
  for (const group of ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']) {
    const groupCard = page.locator('button[aria-pressed]').filter({ hasText: group }).first();
    await expect(groupCard.locator('span').nth(1)).toHaveText('0');
  }
});

test('attendance rejects unknown names and duplicate daily check-ins while preserving roll numbers', async ({ page }) => {
  await page.getByRole('button', { name: 'Manual Attendance' }).click();
  const attendanceInput = page.getByPlaceholder(/e\.g\. TGT-2026/);
  await attendanceInput.fill('ddd');
  await page.getByRole('button', { name: 'Check In' }).click();
  await expect(page.getByRole('alert')).toHaveText('Student not found! Please enter a valid Roll Number.');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tgt_db_data') || '{}').attendance))
    .toHaveLength(0);

  await enrollMember(page, 'Uzzi', '03001230111', 2000);
  await page.getByRole('button', { name: 'Close receipt' }).click();
  await enrollMember(page, 'Rafi', '03001230222', 2000);
  await page.getByRole('button', { name: 'Close receipt' }).click();

  await page.getByRole('button', { name: 'Manual Attendance' }).click();
  await attendanceInput.fill('Uzzi');
  await page.locator('form').last().getByRole('button', { name: 'Check In' }).click();
  await expect(page.getByRole('status')).toContainText('Check-in approved: Welcome Uzzi');

  const uzziRow = page.getByRole('row').filter({ hasText: 'Uzzi' });
  await expect(uzziRow.locator('td').nth(1)).toHaveText('the-gym-town-01');
  await expect(uzziRow.locator('td').nth(1)).not.toContainText('Hyderabad');

  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('tgt_db_data') || '{}');
    stored.attendance[0].rollNumber = 'Hyderabad';
    localStorage.setItem('tgt_db_data', JSON.stringify(stored));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Manual Attendance' }).click();
  const migratedUzziRow = page.getByRole('row').filter({ hasText: 'Uzzi' });
  await expect(migratedUzziRow.locator('td').nth(1)).toHaveText('the-gym-town-01');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tgt_db_data') || '{}').attendance[0].rollNumber))
    .toBe('the-gym-town-01');

  await attendanceInput.fill('Uzzi');
  await page.locator('form').last().getByRole('button', { name: 'Check In' }).click();
  await expect(page.getByRole('alert')).toHaveText('Attendance already marked for today.');

  await attendanceInput.fill('Rafi');
  await page.locator('form').last().getByRole('button', { name: 'Check In' }).click();
  await expect(page.getByRole('status')).toContainText('Check-in approved: Welcome Rafi');

  const rafiRow = page.getByRole('row').filter({ hasText: 'Rafi' });
  await expect(rafiRow.locator('td').nth(1)).toHaveText('the-gym-town-02');
  const attendance = await page.evaluate(() => JSON.parse(localStorage.getItem('tgt_db_data') || '{}').attendance);
  expect(attendance).toHaveLength(2);
  expect(attendance.map((record: { memberName: string }) => record.memberName).sort()).toEqual(['Rafi', 'Uzzi']);
});

test('member information edits update the existing record without duplicating payments', async ({ page }) => {
  await enrollMember(page, 'QA Edit Member', '03003334444', 2000);
  await page.getByRole('button', { name: 'Close receipt' }).click();
  await page.getByRole('button', { name: 'Member Directory' }).click();

  const memberRow = page.getByRole('row').filter({ hasText: 'QA Edit Member' });
  await memberRow.getByTitle('Edit member information').click();
  await page.getByLabel('Full name').fill('QA Edited Member');
  await page.getByLabel('Phone number').fill('03003334445');
  await page.getByLabel('Admission date').fill('2026-09-01');
  await page.getByLabel('Membership start date').fill('2026-10-01');
  await page.getByLabel('Membership duration (months)').fill('3');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  const updatedRow = page.getByRole('row').filter({ hasText: 'QA Edited Member' });
  await expect(updatedRow).toContainText('03003334445');
  await expect(updatedRow).toContainText('2027-01-01');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tgt_db_data') || '{}'));
  expect(stored.members).toHaveLength(1);
  expect(stored.members[0].registrationDate).toBe('2026-09-01');
  expect(stored.payments).toHaveLength(1);
});

test('monthly attendance displays database check-ins by member and calendar day', async ({ page }) => {
  await enrollMember(page, 'QA Calendar Member', '03005556666', 2000);
  await page.getByRole('button', { name: 'Close receipt' }).click();
  await page.getByRole('button', { name: 'Manual Attendance' }).click();
  await page.getByPlaceholder(/e\.g\. TGT-2026/).fill('QA Calendar Member');
  await page.locator('form').last().getByRole('button', { name: 'Check In' }).click();
  await page.getByRole('button', { name: 'Monthly Attendance' }).click();

  await page.getByLabel('Member').selectOption({ label: 'the-gym-town-01 — QA Calendar Member' });
  await expect(page.getByText('Present: 1')).toBeVisible();
  await expect(page.getByText('Absent:')).toBeVisible();
  const today = new Date().getDate();
  await expect(page.locator('tbody tr').filter({ hasText: 'QA Calendar Member' }).locator('td').nth(today - 1)).toHaveText('P');
});

test('expiry alert opens a reviewable WhatsApp reminder for the registered phone', async ({ page }) => {
  await enrollMember(page, 'QA Expiring Member', '03007778888', 2000);
  await page.getByRole('button', { name: 'Close receipt' }).click();
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('tgt_db_data') || '{}');
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 3);
    stored.members[0].expiryDate = `${expiry.getFullYear()}-${String(expiry.getMonth() + 1).padStart(2, '0')}-${String(expiry.getDate()).padStart(2, '0')}`;
    localStorage.setItem('tgt_db_data', JSON.stringify(stored));
  });
  await page.reload();

  const alertRow = page.getByRole('row').filter({ hasText: 'QA Expiring Member' });
  await expect(page.getByRole('heading', { name: /Membership Expiring Soon/ })).toBeVisible();
  await expect(alertRow).toContainText('03007778888');
  await expect(alertRow).toContainText('3 days');
  await alertRow.getByRole('button', { name: 'Send WhatsApp Message' }).click();
  const openedUrl = await page.evaluate(() => (window as Window & { __openedUrl?: string }).__openedUrl || '');
  expect(openedUrl).toContain('wa.me/923007778888');
  expect(decodeURIComponent(openedUrl)).toContain('your membership at The Gym Town is expiring in 3 days');
  await expect(alertRow.getByRole('button', { name: 'Reminder opened' })).toBeDisabled();
});

test('fee record collection creates a cash receipt and prints without dashboard chrome', async ({ page }) => {
  await enrollMember(page, 'QA Fee Member', '03007654321', 2000);
  await page.getByRole('button', { name: 'Close receipt' }).click();
  await page.getByRole('button', { name: 'Member Fee Record' }).click();
  await page.getByRole('button', { name: 'Collect Payment' }).click();

  const amountInput = page.getByLabel('Amount');
  await amountInput.fill('2000');
  await expect(page.getByLabel('Payment Method').locator('option')).toHaveCount(1);
  await page.getByRole('button', { name: 'Record Payment' }).click();
  await expect(page.getByText(/Receipt Issued:/)).toBeVisible();

  const receipt = page.locator('.print-receipt');
  const receiptLogo = receipt.locator('img.receipt-logo');
  await expect(receiptLogo).toHaveAttribute('src', '/logo.png');
  await expect(receiptLogo).toBeVisible();
  await expect.poll(() => receiptLogo.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await expect(receipt).toContainText('QA Fee Member');
  await expect(receipt).toContainText('the-gym-town-01');
  await expect(receipt).toContainText('Rs. 2,000');
  await expect(receipt).toContainText('Rs. 500 when membership payment is overdue.');
  await expect(receipt).toContainText('CASH ONLY');
  await expect.poll(() => page.evaluate(() => (window as Window & { __printCalls?: number }).__printCalls))
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: '58mm' }).click();
  await page.emulateMedia({ media: 'print' });
  const printMetrics58 = await receipt.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const logoStyle = getComputedStyle(element.querySelector('.receipt-logo')!);
    return {
      width: rect.width,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      fontFamily: style.fontFamily,
      controlBarDisplay: getComputedStyle(document.querySelector('.no-print')!).display,
      logoFilter: logoStyle.filter,
    };
  });
  expect(printMetrics58.width).toBeCloseTo((58 * 96) / 25.4, 0);
  expect(printMetrics58.scrollWidth).toBeLessThanOrEqual(printMetrics58.clientWidth);
  expect(printMetrics58.fontFamily).toContain('monospace');
  expect(printMetrics58.controlBarDisplay).toBe('none');
  expect(printMetrics58.logoFilter).toContain('grayscale(1)');

  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('button', { name: '80mm' }).click();
  await page.emulateMedia({ media: 'print' });
  const printMetrics80 = await receipt.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    };
  });
  expect(printMetrics80.width).toBeCloseTo((80 * 96) / 25.4, 0);
  expect(printMetrics80.scrollWidth).toBeLessThanOrEqual(printMetrics80.clientWidth);
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('button', { name: 'Close receipt' }).click();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tgt_db_data') || '{}'));
  expect(stored.payments).toHaveLength(2);
  expect(stored.payments[0].amount).toBe(2000);
  expect(stored.payments[0].receiptNumber).toMatch(/^REC-\d{4}-\d{4}$/);
  expect(stored.members[0].balanceDue).toBe(0);
  expect(stored.members[0].paidAmount).toBe(4000);
});

test('renewal adds the fee and payment exactly once to lifetime totals', async ({ page }) => {
  await enrollMember(page, 'QA Renewal Member', '03006665544', 2000);
  await page.getByRole('button', { name: 'Close receipt' }).click();
  await page.getByRole('button', { name: 'Member Directory' }).click();
  await page.getByRole('button', { name: 'Renew', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Monthly Fee Renewal' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm Renewal' }).click();
  await expect(page.getByText(/Receipt Issued:/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm Renewal' })).toBeDisabled();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tgt_db_data') || '{}'));
  expect(stored.payments).toHaveLength(2);
  expect(stored.members[0].totalFee).toBe(6000);
  expect(stored.members[0].paidAmount).toBe(4000);
  expect(stored.members[0].balanceDue).toBe(2000);
  expect(stored.membershipHistory[0].actionType).toBe('RENEWAL');
});

test('member fee ledger updates balances immediately for partial and advance payments', async ({ page }) => {
  await enrollMember(page, 'QA Ledger Member', '03006665545', 2000);
  await page.getByRole('button', { name: 'Close receipt' }).click();
  await page.getByRole('button', { name: 'Member Fee Record' }).click();
  await expect(page.getByText('Outstanding Due')).toBeVisible();
  await expect(page.getByText('Outstanding Due').locator('..').getByText('Rs. 2,000', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Collect Payment' }).click();
  await page.getByLabel('Amount').fill('1000');
  await page.getByLabel('Payment Date').fill('2026-10-17');
  await page.getByLabel('Notes').fill('Partial payment');
  await page.getByRole('button', { name: 'Record Payment' }).click();
  await page.getByRole('button', { name: 'Close receipt' }).click();
  await expect(page.getByText('Outstanding Due')).toBeVisible();
  await expect(page.getByText('Outstanding Due').locator('..').getByText('Rs. 1,000', { exact: true })).toBeVisible();
  await expect(page.getByText('Partial payment')).toBeVisible();

  await page.getByRole('button', { name: 'Collect Payment' }).click();
  await page.getByLabel('Amount').fill('1500');
  await page.getByRole('button', { name: 'Record Payment' }).click();
  await page.getByRole('button', { name: 'Close receipt' }).click();
  await expect(page.getByText('Member Credit')).toBeVisible();
  await expect(page.getByText('Member Credit').locator('..').getByText('Rs. 500', { exact: true })).toBeVisible();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tgt_db_data') || '{}'));
  const member = stored.members[0];
  const ledger = stored.memberFeeLedger.filter((entry: { memberId: string }) => entry.memberId === member.id);
  expect(ledger).toHaveLength(5);
  expect(member.balanceDue).toBe(-500);
  expect(ledger.filter((entry: { type: string }) => entry.type === 'PAYMENT')).toHaveLength(3);
  expect(ledger.find((entry: { description: string }) => entry.description === 'Partial payment').date).toBe('2026-10-17');

  const printCallsBefore = await page.evaluate(() => (window as Window & { __printCalls?: number }).__printCalls || 0);
  await page.getByRole('button', { name: 'Print Fee Record' }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __printCalls?: number }).__printCalls || 0))
    .toBeGreaterThan(printCallsBefore);
  await page.evaluate(() => { document.documentElement.dataset.printTarget = 'fee-record'; });
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-fee-record')).toContainText('QA Ledger Member');
  await expect(page.locator('.print-fee-record')).toContainText('2026-10-17');
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => { delete document.documentElement.dataset.printTarget; });
});

test('registration rejects a missing blood group and payment above the total fee', async ({ page }) => {
  await openEnrollment(page);
  await page.getByLabel('Full Name *').fill('Invalid Enrollment');
  await page.getByLabel('Mobile (WhatsApp) *').fill('03001112222');
  await expect(page.getByLabel('Blood Group *')).toHaveAttribute('required', '');
  expect(await page.locator('form').last().evaluate((form) => (form as HTMLFormElement).checkValidity())).toBe(false);
  await page.getByLabel('Blood Group *').selectOption('A+');
  await page.getByLabel('Amount Received *').fill('5000');
  await page.getByRole('button', { name: 'Register & Enroll Member' }).click();
  await expect(page.getByRole('alert')).toContainText('payment cannot exceed the total fee');
  const members = await page.evaluate(() => JSON.parse(localStorage.getItem('tgt_db_data') || '{}').members);
  expect(members).toHaveLength(0);
});

test('removed member can be restored with payment and attendance history intact', async ({ page }) => {
  await enrollMember(page, 'QA Returning Member', '03009998877', 4000);
  await page.getByRole('button', { name: 'Close receipt' }).click();
  await page.getByRole('button', { name: 'Manual Attendance' }).click();
  await page.getByPlaceholder(/TGT-2026/).fill('the-gym-town-01');
  await page.getByPlaceholder(/TGT-2026/).press('Enter');
  await expect(page.getByText(/Check-in approved: Welcome QA Returning Member/)).toBeVisible();

  await page.getByRole('button', { name: 'Member Directory' }).click();
  await page.getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Membership Actions' }).click();
  await page.getByRole('button', { name: 'Mark as Left' }).click();
  await page.getByRole('button', { name: 'Confirm Leave' }).click();

  await page.getByRole('button', { name: /Removed Members \(/ }).click();
  await expect(page.getByText('QA Returning Member', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).click();
  await page.getByRole('button', { name: /Active Members \(/ }).click();
  await expect(page.getByText('QA Returning Member', { exact: true })).toBeVisible();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tgt_db_data') || '{}'));
  expect(stored.members).toHaveLength(1);
  expect(stored.members[0].id).toBe(stored.attendance[0].memberId);
  expect(stored.members[0].rollNumber).toBe('the-gym-town-01');
  expect(stored.members[0].archived).toBe(false);
  expect(stored.payments).toHaveLength(1);
  expect(stored.members[0].membershipPeriods).toHaveLength(2);
  expect(stored.members[0].membershipPeriods[0].endDate).toBeTruthy();
  expect(stored.members[0].registrationDate).toBe(stored.members[0].membershipPeriods[0].startDate);
  expect(stored.members[0].membershipPeriods[1].startDate).toBeTruthy();
  expect(stored.attendance).toHaveLength(1);

  await page.getByRole('button', { name: 'Member Directory' }).click();
  await page.getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByText('Membership History')).toBeVisible();
  await expect(page.getByText(/Left:/)).toBeVisible();
  await page.getByRole('button', { name: 'Attendance (1)' }).click();
  await expect(page.getByText('Attendance & Turnstile Check-Ins (1 total visits)')).toBeVisible();
  await expect(page.getByText('Granted')).toBeVisible();
});
