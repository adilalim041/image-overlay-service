import { describe, it, expect } from 'vitest';
import { escapeXml, substituteVars } from '../engine/utils.js';

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
