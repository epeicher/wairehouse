import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSession } from '../../src/app-runtime/session';
import type { AppConfig } from '../../src/app-runtime/types';
import '../../src/ui/components/os-button/os-button';
import '../../src/ui/components/os-grid/os-grid';
import '../../src/ui/components/os-display/os-display';

// Behavioural check for the Calculator task. The prompt fixed no API, so this
// finds the app the way a user would: an App Framework app whose definition
// mentions "calculator", its declared state read from the PHP definition, its
// client view mounted through the real runtime session, and its keypad
// pressed by visible label. The readout is read from <os-display>, <output>
// or a live region, whichever the view has.

// vitest runs from the repository root (the harness cds there first).
const ROOT = process.cwd();

function findApp(): string | null {
	const apps = join( ROOT, 'apps' );
	for ( const dir of readdirSync( apps ) ) {
		const path = join( apps, dir );
		let files: string[] = [];
		try {
			files = readdirSync( path );
		} catch {
			continue;
		}
		for ( const file of files ) {
			if ( file.endsWith( '.os.php' ) && /calculator/i.test( dir + file + readFileSync( join( path, file ), 'utf8' ).slice( 0, 4000 ) ) ) {
				return join( path, file );
			}
		}
	}
	return null;
}

function describeApp( file: string ): { id: string; state: Record< string, unknown >; prefetch: boolean } {
	const php = `
		define( 'OPENSTATION_STANDALONE', true );
		foreach ( array( '__', 'esc_html__', 'esc_attr__', '_x', 'esc_html_x', 'esc_attr_x' ) as $f ) {
			if ( ! function_exists( $f ) ) { eval( "function $f( \\$t ) { return \\$t; }" ); }
		}
		if ( ! function_exists( '_n' ) ) { function _n( $s, $p, $n ) { return 1 === $n ? $s : $p; } }
		require ${ JSON.stringify( join( ROOT, 'includes/framework/autoload.php' ) ) };
		define( 'ABSPATH', '/' );
		$app = require ${ JSON.stringify( file ) };
		echo json_encode( array( 'id' => $app->id(), 'state' => (object) $app->defaults(), 'prefetch' => $app->prefetches() ) );
	`;
	return JSON.parse( execFileSync( 'php', [ '-r', php ], { encoding: 'utf8' } ) );
}

const LABELS: Record< string, string[] > = {
	'+': [ '+', 'plus', 'add' ],
	'-': [ '−', '-', '–', 'minus', 'subtract' ],
	'*': [ '×', '*', 'x', '✕', 'multiply', 'times' ],
	'/': [ '÷', '/', 'divide', 'divided by' ],
	'=': [ '=', 'equals' ],
	'.': [ '.', ',', 'decimal', 'decimal point', 'point' ],
	clear: [ 'ac', 'c', 'clear', 'all clear', 'clear all' ],
};

let file: string | null = null;
let meta: ReturnType< typeof describeApp > | null = null;
let client: unknown = null;

beforeAll( async () => {
	file = findApp();
	if ( ! file ) {
		return;
	}
	meta = describeApp( file );
	const ts = file.replace( /\.os\.php$/, '.os.ts' );
	if ( existsSync( ts ) ) {
		client = ( await import( /* @vite-ignore */ ts ) ).default;
	}
} );

describe( 'calculator app', () => {
	let root: HTMLElement;
	let session: ReturnType< typeof createSession > | null = null;
	let calls = 0;

	const mount = async () => {
		expect( file, 'an apps/*/*.os.php that defines the calculator' ).toBeTruthy();
		expect( client, 'a client view (.os.ts) beside it' ).toBeTruthy();
		root = document.createElement( 'div' );
		document.body.appendChild( root );
		const config = {
			osApp: true,
			id: meta!.id,
			title: 'Calculator',
			endpoint: '/dispatch',
			state: meta!.state,
			data: [],
			titleBarButtons: [],
			windowActions: [],
			appearance: {},
			extra: {},
			actions: [],
			client: true,
		} as unknown as AppConfig;
		// Any request is answered with the state it sent, so a view that waits
		// for `mount` still paints; requests made after the mount are counted.
		const fetch = vi.fn( async ( _url: unknown, init?: RequestInit ) => {
			calls++;
			const body = init?.body ? JSON.parse( String( init.body ) ) : {};
			return new Response( JSON.stringify( { ok: true, state: body.state ?? meta!.state, data: [], effects: [] } ), {
				headers: { 'Content-Type': 'application/json' },
			} );
		} );
		session = createSession( { root, config, windowId: meta!.id, host: { fetch } as never, client: client as never } );
		if ( ! session.paintEagerly() ) {
			await session.dispatch?.( 'mount' );
		}
		await new Promise( ( r ) => setTimeout( r, 0 ) );
		calls = 0;
	};

	const buttons = () => [ ...root.querySelectorAll< HTMLElement >( 'os-button, button, [role="button"]' ) ];
	const names = ( b: HTMLElement ) =>
		[ b.textContent, b.getAttribute( 'aria-label' ), b.getAttribute( 'label' ), b.getAttribute( 'title' ) ]
			.filter( Boolean )
			.map( ( s ) => String( s ).trim().toLowerCase() );

	const press = ( ...keys: string[] ) => {
		for ( const key of keys ) {
			const wanted = LABELS[ key ] ?? [ key ];
			const button = buttons().find( ( b ) => names( b ).some( ( n ) => wanted.includes( n ) ) );
			expect( button, `a keypad button for "${ key }"` ).toBeTruthy();
			button!.click();
		}
	};

	const readout = (): string => {
		const el =
			root.querySelector< HTMLElement & { value?: string } >( 'os-display' ) ??
			root.querySelector< HTMLElement & { value?: string } >( 'output' ) ??
			root.querySelector< HTMLElement & { value?: string } >( '[aria-live], [role="status"]' );
		expect( el, 'a readout' ).toBeTruthy();
		const text = el!.textContent?.trim() || String( el!.value ?? el!.getAttribute( 'value' ) ?? '' );
		return text.replace( /\s/g, '' ).replace( /−/g, '-' );
	};

	const type = ( ...keys: string[] ) => {
		const target =
			root.querySelector< HTMLElement >( '[os-on~="keydown"]' ) ??
			root.querySelector< HTMLElement >( '[tabindex]:not(os-button):not(button)' ) ??
			( root.firstElementChild as HTMLElement | null ) ??
			root;
		target.focus?.();
		for ( const key of keys ) {
			target.dispatchEvent( new KeyboardEvent( 'keydown', { key, bubbles: true, cancelable: true, composed: true } ) );
		}
	};

	afterEach( () => {
		session?.dispose();
		session = null;
		document.body.innerHTML = '';
	} );

	it( 'adds from the keypad without a request', async () => {
		await mount();
		press( '7', '+', '5', '=' );
		expect( readout() ).toBe( '12' );
		expect( calls ).toBe( 0 );
	} );

	it( 'subtracts, multiplies and divides', async () => {
		await mount();
		press( '9', '-', '4', '=' );
		expect( readout() ).toBe( '5' );
		press( 'clear', '6', '*', '7', '=' );
		expect( readout() ).toBe( '42' );
		press( 'clear', '8', '/', '2', '=' );
		expect( readout() ).toBe( '4' );
	} );

	it( 'clears back to zero', async () => {
		await mount();
		press( '4', '2', 'clear' );
		expect( readout() ).toBe( '0' );
	} );

	it( 'hides binary rounding noise', async () => {
		await mount();
		press( '0', '.', '1', '+', '0', '.', '2', '=' );
		expect( readout() ).toBe( '0.3' );
	} );

	it( 'never shows Infinity or NaN after dividing by zero, and recovers', async () => {
		await mount();
		press( '8', '/', '0', '=' );
		expect( readout() ).not.toMatch( /infinity|nan|∞/i );
		press( 'clear', '2', '+', '3', '=' );
		expect( readout() ).toBe( '5' );
	} );

	it( 'takes keyboard input while focused', async () => {
		await mount();
		type( '6', '*', '7', 'Enter' );
		expect( readout() ).toBe( '42' );
		expect( calls ).toBe( 0 );
	} );
} );
