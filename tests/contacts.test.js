import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@getbrevo/brevo', () => ({
  CreateContact: class {},
  UpdateContact: class {},
  RequestContactImport: class {},
  ContactsApi: class {
    authentications = { apiKey: { apiKey: '' } };
  },
}));

vi.mock('../src/config/brevoClient.js', () => ({
  getContactsApi: vi.fn(),
}));

import { getContactsApi } from '../src/config/brevoClient.js';
import { createContact } from '../src/contacts/createContact.js';
import { updateContact } from '../src/contacts/updateContact.js';
import { deleteContact } from '../src/contacts/deleteContact.js';
import { tagContact } from '../src/contacts/tagContact.js';
import { segmentContact } from '../src/contacts/segmentContact.js';
import { bulkSyncContacts } from '../src/contacts/bulkSync.js';

let api;

beforeEach(() => {
  api = {
    createContact: vi.fn().mockResolvedValue({ body: { id: 42 } }),
    updateContact: vi.fn().mockResolvedValue({}),
    deleteContact: vi.fn().mockResolvedValue({}),
    getContactInfo: vi.fn().mockResolvedValue({ body: { attributes: { TAGS: '' } } }),
    importContacts: vi.fn().mockResolvedValue({ body: {} }),
  };
  vi.mocked(getContactsApi).mockReturnValue(api);
});

// ─── createContact ───────────────────────────────────────────────────────────

describe('createContact', () => {
  it('creates a contact and returns its id', async () => {
    const result = await createContact({ email: 'user@example.com', name: 'Muhammad' });
    expect(result.success).toBe(true);
    expect(result.data.id).toBe(42);
    expect(api.createContact).toHaveBeenCalledOnce();
  });

  it('splits name into FIRSTNAME/LASTNAME attributes', async () => {
    await createContact({ email: 'u@e.com', name: 'Muhammad Saleem' });
    const [[arg]] = api.createContact.mock.calls;
    expect(arg.attributes.FIRSTNAME).toBe('Muhammad');
    expect(arg.attributes.LASTNAME).toBe('Saleem');
  });

  it('assigns list from BREVO_LIST_PRO env var when plan is pro', async () => {
    process.env.BREVO_LIST_PRO = '7';
    await createContact({ email: 'u@e.com', plan: 'pro' });
    const [[arg]] = api.createContact.mock.calls;
    expect(arg.listIds).toContain(7);
    delete process.env.BREVO_LIST_PRO;
  });

  it('uses explicit listIds over plan env var', async () => {
    process.env.BREVO_LIST_FREE = '1';
    await createContact({ email: 'u@e.com', plan: 'free', listIds: [99] });
    const [[arg]] = api.createContact.mock.calls;
    expect(arg.listIds).toEqual([99]);
    delete process.env.BREVO_LIST_FREE;
  });

  it('returns failure on invalid email', async () => {
    const result = await createContact({ email: 'bad-email', name: 'M' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch('validation failed');
  });

  it('returns failure when Brevo API throws', async () => {
    api.createContact.mockRejectedValue({ response: { body: { message: 'Contact already exists' } } });
    const result = await createContact({ email: 'u@e.com' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch('Contact already exists');
  });
});

// ─── updateContact ───────────────────────────────────────────────────────────

describe('updateContact', () => {
  it('updates contact attributes', async () => {
    const result = await updateContact({ email: 'u@e.com', attributes: { COMPANY: 'ITivs' } });
    expect(result.success).toBe(true);
    expect(result.data.email).toBe('u@e.com');
    expect(api.updateContact).toHaveBeenCalledOnce();
  });

  it('sets emailBlacklisted flag', async () => {
    await updateContact({ email: 'u@e.com', emailBlacklisted: true });
    const [identifier, arg] = api.updateContact.mock.calls[0];
    expect(identifier).toBe('u@e.com');
    expect(arg.emailBlacklisted).toBe(true);
  });

  it('returns failure on invalid email', async () => {
    const result = await updateContact({ email: 'not-email' });
    expect(result.success).toBe(false);
  });
});

// ─── deleteContact ───────────────────────────────────────────────────────────

describe('deleteContact', () => {
  it('deletes a contact by email', async () => {
    const result = await deleteContact({ email: 'u@e.com' });
    expect(result.success).toBe(true);
    expect(result.data.email).toBe('u@e.com');
    expect(api.deleteContact).toHaveBeenCalledWith('u@e.com');
  });

  it('returns failure on invalid email', async () => {
    const result = await deleteContact({ email: 'bad' });
    expect(result.success).toBe(false);
  });

  it('returns failure when Brevo API throws', async () => {
    api.deleteContact.mockRejectedValue({ response: { body: { message: 'Contact not found' } } });
    const result = await deleteContact({ email: 'u@e.com' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch('Contact not found');
  });
});

// ─── tagContact ──────────────────────────────────────────────────────────────

describe('tagContact', () => {
  it('adds tags to contact (merges with existing)', async () => {
    api.getContactInfo.mockResolvedValue({ body: { attributes: { TAGS: 'signup' } } });
    const result = await tagContact({ email: 'u@e.com', tags: ['pro-user', 'upgraded'] });
    expect(result.success).toBe(true);
    expect(result.data.tags).toContain('signup');
    expect(result.data.tags).toContain('pro-user');
    expect(result.data.tags).toContain('upgraded');
  });

  it('removes tags with action: remove', async () => {
    api.getContactInfo.mockResolvedValue({ body: { attributes: { TAGS: 'signup,pro-user' } } });
    const result = await tagContact({ email: 'u@e.com', tags: ['pro-user'], action: 'remove' });
    expect(result.success).toBe(true);
    expect(result.data.tags).not.toContain('pro-user');
    expect(result.data.tags).toContain('signup');
  });

  it('replaces all tags with action: set', async () => {
    api.getContactInfo.mockResolvedValue({ body: { attributes: { TAGS: 'old-tag' } } });
    const result = await tagContact({ email: 'u@e.com', tags: ['new-tag'], action: 'set' });
    expect(result.success).toBe(true);
    expect(result.data.tags).toEqual(['new-tag']);
  });

  it('deduplicates tags on add', async () => {
    api.getContactInfo.mockResolvedValue({ body: { attributes: { TAGS: 'signup' } } });
    const result = await tagContact({ email: 'u@e.com', tags: ['signup', 'new'] });
    expect(result.data.tags.filter(t => t === 'signup').length).toBe(1);
  });

  it('returns failure on empty tags array', async () => {
    const result = await tagContact({ email: 'u@e.com', tags: [] });
    expect(result.success).toBe(false);
  });
});

// ─── segmentContact ───────────────────────────────────────────────────────────

describe('segmentContact', () => {
  it('uses listId from options when provided', async () => {
    const result = await segmentContact({ email: 'u@e.com', plan: 'pro', listId: 42 });
    expect(result.success).toBe(true);
    expect(result.data.listId).toBe(42);
    const [, arg] = api.updateContact.mock.calls[0];
    expect(arg.listIds).toContain(42);
  });

  it('reads listId from env var when no override provided', async () => {
    process.env.BREVO_LIST_ENTERPRISE = '9';
    const result = await segmentContact({ email: 'u@e.com', plan: 'enterprise' });
    expect(result.success).toBe(true);
    expect(result.data.listId).toBe(9);
    delete process.env.BREVO_LIST_ENTERPRISE;
  });

  it('returns descriptive error when env var is missing', async () => {
    delete process.env.BREVO_LIST_FREE;
    const result = await segmentContact({ email: 'u@e.com', plan: 'free' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch('BREVO_LIST_FREE');
  });

  it('removes from other plan lists when removeFromOtherPlans is true', async () => {
    process.env.BREVO_LIST_FREE = '1';
    process.env.BREVO_LIST_PRO = '2';
    process.env.BREVO_LIST_ENTERPRISE = '3';
    await segmentContact({ email: 'u@e.com', plan: 'pro', listId: 2, removeFromOtherPlans: true });
    const [, arg] = api.updateContact.mock.calls[0];
    expect(arg.unlinkListIds).toContain(1);
    expect(arg.unlinkListIds).toContain(3);
    delete process.env.BREVO_LIST_FREE;
    delete process.env.BREVO_LIST_PRO;
    delete process.env.BREVO_LIST_ENTERPRISE;
  });
});

// ─── bulkSyncContacts ─────────────────────────────────────────────────────────

describe('bulkSyncContacts', () => {
  it('syncs contacts and reports count', async () => {
    const contacts = [{ email: 'a@e.com', name: 'A' }, { email: 'b@e.com', name: 'B' }];
    const result = await bulkSyncContacts({ contacts });
    expect(result.success).toBe(true);
    expect(result.data.synced).toBe(2);
    expect(result.data.errors).toHaveLength(0);
  });

  it('returns failure on empty contacts array', async () => {
    const result = await bulkSyncContacts({ contacts: [] });
    expect(result.success).toBe(false);
  });

  it('reports partial failure when a batch fails', async () => {
    api.importContacts
      .mockResolvedValueOnce({ body: {} })
      .mockRejectedValueOnce(new Error('Batch error'));
    const contacts = Array.from({ length: 151 }, (_, i) => ({ email: `u${i}@e.com` }));
    const result = await bulkSyncContacts({ contacts });
    expect(result.data.errors.length).toBeGreaterThan(0);
  });
});
