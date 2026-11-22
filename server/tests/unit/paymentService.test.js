const PaymentService = require('../../src/payments/PaymentService');
const PaymentProviderRegistry = require('../../src/payments/PaymentProviderRegistry');
const BkashMockProvider = require('../../src/payments/providers/BkashMockProvider');
const CardMockProvider = require('../../src/payments/providers/CardMockProvider');
const NagadMockProvider = require('../../src/payments/providers/NagadMockProvider');
const PaymentProvider = require('../../src/payments/providers/PaymentProvider');
const { FakePaymentRepo, silentLogger } = require('../fakes');

const booking = { _id: 'bk1', customer: 'u1', currency: 'BDT', pricing: { total: 1500 } };
const bkash = { walletNumber: '01712345678' };

function setup() {
  const repo = new FakePaymentRepo();
  const card = new CardMockProvider();
  const chargeSpy = jest.spyOn(card, 'charge');
  const registry = new PaymentProviderRegistry([new BkashMockProvider(), card, new NagadMockProvider()]);
  return { repo, chargeSpy, service: new PaymentService({ paymentRepository: repo, providerRegistry: registry, logger: silentLogger }) };
}

describe('PaymentService idempotency', () => {
  test('charges once, replays on retry with the same key', async () => {
    const { service, repo, chargeSpy } = setup();
    const first = await service.pay({ booking, providerId: 'card', idempotencyKey: 'k1', details: { cardNumber: '4242424242424242' } });
    const retry = await service.pay({ booking, providerId: 'card', idempotencyKey: 'k1', details: { cardNumber: '4242424242424242' } });
    expect(first.payment.status).toBe('SUCCEEDED');
    expect(retry.replayed).toBe(true);
    expect(retry.payment._id).toBe(first.payment._id);
    expect(chargeSpy).toHaveBeenCalledTimes(1);
    expect(repo.items).toHaveLength(1);
  });

  test('10 simultaneous retries with one key -> exactly one charge', async () => {
    const { service, repo, chargeSpy } = setup();
    const results = await Promise.all(Array.from({ length: 10 }, () => service.pay({ booking, providerId: 'card', idempotencyKey: 'same', details: { cardNumber: '4242424242424242' } })));
    expect(chargeSpy).toHaveBeenCalledTimes(1);
    expect(repo.items).toHaveLength(1);
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
  });

  test('a different key on an already-paid booking does not charge again', async () => {
    const { service, chargeSpy } = setup();
    await service.pay({ booking, providerId: 'card', idempotencyKey: 'a', details: { cardNumber: '4242424242424242' } });
    const second = await service.pay({ booking, providerId: 'card', idempotencyKey: 'b', details: { cardNumber: '4242424242424242' } });
    expect(second.replayed).toBe(true);
    expect(chargeSpy).toHaveBeenCalledTimes(1);
  });

  test('reusing a key for another booking is rejected', async () => {
    const { service } = setup();
    await service.pay({ booking, providerId: 'bkash', idempotencyKey: 'k', details: bkash });
    await expect(service.pay({ booking: { ...booking, _id: 'other' }, providerId: 'bkash', idempotencyKey: 'k', details: bkash }))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  test('failed charge is recorded and a new key can retry', async () => {
    const { service } = setup();
    const failed = await service.pay({ booking, providerId: 'card', idempotencyKey: 'f1', details: { cardNumber: '4000000000000002' } });
    expect(failed.payment).toMatchObject({ status: 'FAILED', failureReason: 'Card declined by bank' });
    const ok = await service.pay({ booking, providerId: 'card', idempotencyKey: 'f2', details: { cardNumber: '4242424242424242' } });
    expect(ok.payment.status).toBe('SUCCEEDED');
  });

  test('requires a key and a known provider', async () => {
    const { service } = setup();
    await expect(service.pay({ booking, providerId: 'card' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.pay({ booking, providerId: 'paypal', idempotencyKey: 'x' })).rejects.toThrow(/Unsupported payment provider/);
  });

  test('refund marks the payment REFUNDED; ignores zero amounts', async () => {
    const { service, repo } = setup();
    const { payment } = await service.pay({ booking, providerId: 'bkash', idempotencyKey: 'r', details: bkash });
    expect(await service.refund(payment, 0)).toBeNull();
    const res = await service.refund(payment, 1500);
    expect(res.success).toBe(true);
    expect(repo.items[0]).toMatchObject({ status: 'REFUNDED', refundedAmount: 1500 });
  });
});

describe('Mock providers share one interface', () => {
  test.each([
    ['bkash', new BkashMockProvider(), { walletNumber: '01812345678' }, { walletNumber: '123' }],
    ['nagad', new NagadMockProvider(), { walletNumber: '01912345678' }, { walletNumber: 'abc' }],
    ['card', new CardMockProvider(), { cardNumber: '4242 4242 4242 4242' }, { cardNumber: '42' }],
  ])('%s charges valid details and rejects invalid ones', async (_id, provider, good, bad) => {
    expect(provider).toBeInstanceOf(PaymentProvider);
    expect((await provider.charge({ amount: 100, details: good })).success).toBe(true);
    expect((await provider.charge({ amount: 100, details: bad })).success).toBe(false);
    expect((await provider.charge({ amount: 0, details: good })).success).toBe(false);
    expect((await provider.refund({ providerRef: 'X', amount: 100 })).success).toBe(true);
  });

  test('bKash test wallet 01700000000 simulates insufficient balance', async () => {
    const r = await new BkashMockProvider().charge({ amount: 100, details: { walletNumber: '01700000000' } });
    expect(r).toMatchObject({ success: false, failureReason: 'Insufficient bKash balance' });
  });

  test('registry lists providers for the UI', () => {
    const reg = new PaymentProviderRegistry([new BkashMockProvider(), new CardMockProvider()]);
    expect(reg.list()).toEqual([{ id: 'bkash', name: 'bKash' }, { id: 'card', name: 'Visa / Mastercard' }]);
  });
});
