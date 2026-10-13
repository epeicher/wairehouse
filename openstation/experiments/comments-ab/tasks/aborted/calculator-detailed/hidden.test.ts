import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState, pressKey } from '../../apps/calculator/parts/engine';
import calculator from '../../apps/calculator/calculator.os';
import { createSession } from '../../src/app-runtime/session';
import type { AppConfig } from '../../src/app-runtime/types';
import '../../src/ui/components/os-button/os-button';
import '../../src/ui/components/os-grid/os-grid';
import '../../src/ui/components/os-display/os-display';

// Behavioural check for the Calculator task. Only the surface the prompt
// fixed is used: the engine's initialState() / pressKey( state, key ) with
// state.display, the app's client view mounted through the real runtime
// session, keyboard input on the focused calculator, and a digit button.

type Engine = { display: string } & Record< string, unknown >;
const press = pressKey as unknown as ( state: Engine, key: string ) => Engine;
const start = initialState as unknown as () => Engine;
const run = ( ...keys: string[] ) => keys.reduce( press, start() );

describe( 'calculator engine', () => {
	it( 'does the four operations', () => {
		expect( run( '8', '+', '2', '=' ).display ).toBe( '10' );
		expect( run( '8', '-', '2', '=' ).display ).toBe( '6' );
		expect( run( '8', '*', '2', '=' ).display ).toBe( '16' );
		expect( run( '8', '/', '2', '=' ).display ).toBe( '4' );
	} );

	it( 'runs left to right and replaces a pending operator', () => {
		expect( run( '2', '+', '3', '*', '4', '=' ).display ).toBe( '20' );
		expect( run( '9', '+', '-', '2', '=' ).display ).toBe( '7' );
	} );

	it( 'repeats equals and starts over on a digit after equals', () => {
		expect( run( '5', '+', '2', '=', '=' ).display ).toBe( '9' );
		expect( run( '5', '+', '2', '=', '3', '=' ).display ).toBe( '3' );
	} );

	it( 'applies the percentage rules', () => {
		expect( run( '2', '0', '0', '+', '1', '0', '%', '=' ).display ).toBe( '220' );
		expect( run( '2', '0', '0', '-', '1', '0', '%', '=' ).display ).toBe( '180' );
		expect( run( '2', '0', '0', '*', '1', '0', '%', '=' ).display ).toBe( '20' );
		expect( run( '5', '0', '%' ).display ).toBe( '0.5' );
	} );

	it( 'handles decimals and rounding', () => {
		expect( run( '.', '1', '+', '.', '2', '=' ).display ).toBe( '0.3' );
		expect( run( '1', '.', '.', '2' ).display ).toBe( '1.2' );
		expect( run( '2', '/', '3', '=' ).display ).toBe( '0.666666666667' );
	} );

	it( 'changes sign and deletes the last digit', () => {
		expect( run( '5', 'sign' ).display ).toBe( '-5' );
		expect( run( '2', '+', '3', 'sign', '=' ).display ).toBe( '-1' );
		expect( run( '1', '2', 'backspace' ).display ).toBe( '1' );
	} );

	it( 'shows Error on division by zero and recovers', () => {
		expect( run( '8', '/', '0', '=' ).display ).toBe( 'Error' );
		expect( run( '8', '/', '0', '=', '2', '+', '3', '=' ).display ).toBe( '5' );
		expect( run( '8', '/', '0', '=', 'clear' ) ).toEqual( start() );
	} );

	it( 'stops entry at 12 digits', () => {
		expect( run( ...'1234567890123' ).display ).toBe( '123456789012' );
	} );

	it( 'never mutates the state it was given', () => {
		const state = run( '1', '2', '+', '3' );
		const before = JSON.stringify( state );
		for ( const key of [ '4', '.', '=', '%', 'sign', 'backspace', 'clear', '+' ] ) {
			press( state, key );
		}
		expect( JSON.stringify( state ) ).toBe( before );
		expect( start().display ).toBe( '0' );
	} );
} );

describe( 'calculator window', () => {
	let root: HTMLElement;
	let fetch: ReturnType< typeof vi.fn >;
	let session: ReturnType< typeof createSession >;

	// Where a keydown goes: the element the app listens on, else the focused
	// calculator surface, else the app's own top element.
	const target = (): HTMLElement =>
		root.querySelector< HTMLElement >( '[os-on~="keydown"]' ) ??
		root.querySelector< HTMLElement >( '[tabindex]:not(os-button)' ) ??
		( root.firstElementChild as HTMLElement | null ) ??
		root;

	const type = ( ...keys: Array< string | KeyboardEventInit > ) => {
		const el = target();
		el.focus?.();
		for ( const k of keys ) {
			const init = typeof k === 'string' ? { key: k } : k;
			el.dispatchEvent( new KeyboardEvent( 'keydown', { bubbles: true, cancelable: true, composed: true, ...init } ) );
		}
	};

	const display = () => ( session.state as Engine ).display;

	beforeEach( async () => {
		root = document.createElement( 'div' );
		document.body.appendChild( root );
		fetch = vi.fn( () => new Promise< Response >( () => {} ) );
		const id = ( calculator as unknown as { id?: string } ).id ?? 'openstation-calculator';
		const config = {
			osApp: true,
			id,
			title: 'Calculator',
			endpoint: '/dispatch',
			state: start(),
			data: [],
			titleBarButtons: [],
			windowActions: [],
			appearance: {},
			extra: {},
			actions: [],
			client: true,
		} as unknown as AppConfig;
		session = createSession( {
			root,
			config,
			windowId: id,
			host: { fetch } as never,
			client: calculator as never,
		} );
		session.paintEagerly();
		await Promise.resolve();
		await new Promise( ( r ) => setTimeout( r, 0 ) );
	} );

	afterEach( () => {
		session.dispose();
		document.body.innerHTML = '';
	} );

	it( 'calculates from the keyboard without a request', () => {
		type( '7', '+', '5', 'Enter' );
		expect( display() ).toBe( '12' );
		type( '*', '3', '=' );
		expect( display() ).toBe( '36' );
		expect( fetch ).not.toHaveBeenCalled();
	} );

	it( 'maps Backspace, Delete and Escape', () => {
		type( '4', '2', 'Backspace' );
		expect( display() ).toBe( '4' );
		type( 'Delete' );
		expect( display() ).toBe( '0' );
		type( '9', 'Escape' );
		expect( display() ).toBe( '0' );
	} );

	it( 'ignores modified keys and keys typed outside the calculator', () => {
		type( '3' );
		type( { key: '9', ctrlKey: true }, { key: '9', metaKey: true }, { key: '9', altKey: true } );
		document.body.dispatchEvent( new KeyboardEvent( 'keydown', { key: '9', bubbles: true } ) );
		expect( display() ).toBe( '3' );
	} );

	it( 'presses a digit from its keypad button', () => {
		const seven = [ ...root.querySelectorAll< HTMLElement >( 'os-button, button' ) ].find(
			( b ) => b.textContent?.trim() === '7' || b.getAttribute( 'aria-label' ) === '7'
		);
		expect( seven ).toBeTruthy();
		seven!.click();
		expect( display() ).toBe( '7' );
		expect( fetch ).not.toHaveBeenCalled();
	} );
} );
