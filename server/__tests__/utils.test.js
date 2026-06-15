import { describe, it, expect } from 'vitest';
import {
    assertSafeImageUrl,
    escapeXml,
    isPrivateAddress,
    resolvePublicAddresses,
    substituteVars
} from '../engine/utils.js';

describe('escapeXml', () => {
    it('escapes special characters', () => {
        expect(escapeXml('a & b')).toBe('a &amp; b');
        expect(escapeXml('<div>')).toBe('&lt;div&gt;');
        expect(escapeXml('"hello"')).toBe('&quot;hello&quot;');
        expect(escapeXml("it's")).toBe("it&apos;s");
    });

    it('handles null/undefined', () => {
        expect(escapeXml(null)).toBe('');
        expect(escapeXml(undefined)).toBe('');
    });

    it('passes through normal text', () => {
        expect(escapeXml('hello world')).toBe('hello world');
    });
});

describe('substituteVars', () => {
    it('replaces template variables', () => {
        expect(substituteVars('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
    });

    it('replaces multiple variables', () => {
        expect(substituteVars('{{a}} and {{b}}', { a: '1', b: '2' })).toBe('1 and 2');
    });

    it('leaves unknown variables intact', () => {
        expect(substituteVars('Hello {{unknown}}', {})).toBe('Hello {{unknown}}');
    });

    it('handles null/undefined text', () => {
        expect(substituteVars(null, { a: 1 })).toBe(null);
        expect(substituteVars(undefined, {})).toBe(undefined);
    });

    it('trims variable names', () => {
        expect(substituteVars('{{ name }}', { name: 'test' })).toBe('test');
    });
});

describe('image URL safety', () => {
    const resolverFor = (addresses) => async () => addresses;

    it('blocks localhost hostnames', async () => {
        await expect(resolvePublicAddresses('localhost', resolverFor([{ address: '127.0.0.1', family: 4 }]))).rejects.toThrow('Blocked private image host');
    });

    it('blocks private IPv4 addresses', () => {
        expect(isPrivateAddress('127.0.0.1')).toBe(true);
        expect(isPrivateAddress('10.1.2.3')).toBe(true);
        expect(isPrivateAddress('172.16.0.1')).toBe(true);
        expect(isPrivateAddress('192.168.1.1')).toBe(true);
        expect(isPrivateAddress('169.254.10.10')).toBe(true);
    });

    it('allows public IPv4 addresses', () => {
        expect(isPrivateAddress('8.8.8.8')).toBe(false);
    });

    it('blocks hostnames that resolve to private addresses', async () => {
        await expect(resolvePublicAddresses(
            'example.com',
            resolverFor([{ address: '192.168.1.10', family: 4 }])
        )).rejects.toThrow('Blocked private image host');
    });

    it('requires http or https URLs', async () => {
        await expect(assertSafeImageUrl('file:///etc/passwd')).rejects.toThrow('Unsupported image URL protocol');
    });

    it('rejects URL credentials', async () => {
        await expect(assertSafeImageUrl('https://user:pass@example.com/a.png')).rejects.toThrow('Image URL credentials are not allowed');
    });

    it('returns resolved public addresses for safe URLs', async () => {
        const result = await assertSafeImageUrl('https://cdn.example.com/a.png', {
            resolver: resolverFor([{ address: '93.184.216.34', family: 4 }])
        });
        expect(result.parsed.hostname).toBe('cdn.example.com');
        expect(result.addresses).toEqual([{ address: '93.184.216.34', family: 4 }]);
    });
});
