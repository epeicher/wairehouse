import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { WindowManager } from '../../src/window-manager';
import { restoreSession } from '../../src/boot/session';
import { clearHooksStub, installHooksStub } from './helpers/hooks-stub';
import type { DesktopConfig, Session } from '../../src/types';

// Behavioural check for the "Keep on top" task. Only the public surface named
// in the prompt is used: windowManager.setAlwaysOnTop( id, enabled ), the
// window's alwaysOnTop property, inline z-index, and the session snapshot.

const ORIGIN = window.location.origin;

type OnTopManager = WindowManager & {
	setAlwaysOnTop( windowId: string, enabled: boolean ): void;
};

function cfg( id: string ) {
	return {
		id,
		url: `${ ORIGIN }/wp-admin/${ id }.php`,
		title: id,
		icon: 'dashicons-admin-generic',
	};
}

function makeDesktop(): HTMLElement {
	const desktop = document.createElement( 'div' );
	desktop.id = 'os-area';
	Object.defineProperty( desktop, 'getBoundingClientRect', {
		value: () =>
			( {
				left: 0,
				top: 0,
				right: 1600,
				bottom: 900,
				width: 1600,
				height: 900,
				x: 0,
				y: 0,
				toJSON: () => ( {} ),
			} ) as DOMRect,
	} );
	Object.defineProperty( desktop, 'clientWidth', { value: 1600, configurable: true } );
	Object.defineProperty( desktop, 'clientHeight', { value: 900, configurable: true } );
	return desktop;
}

function z( manager: WindowManager, id: string ): number {
	const win = manager.getById( id );
	if ( ! win ) {
		throw new Error( `no window ${ id }` );
	}
	const n = parseInt( win.element.style.zIndex, 10 );
	if ( ! Number.isFinite( n ) ) {
		throw new Error( `window ${ id } has no inline z-index` );
	}
	return n;
}

function onTop( manager: WindowManager, id: string ): boolean {
	const win = manager.getById( id ) as unknown as { alwaysOnTop?: unknown };
	return win.alwaysOnTop === true;
}

describe( 'keep on top (hidden harness test)', () => {
	let desktop: HTMLElement;
	let manager: OnTopManager;

	beforeEach( () => {
		installHooksStub();
		desktop = makeDesktop();
		document.body.appendChild( desktop );
		manager = new WindowManager( desktop ) as OnTopManager;
	} );

	afterEach( () => {
		for ( const w of manager.getAll() ) {
			w.destroy();
		}
		desktop.remove();
		clearHooksStub();
	} );

	test( 'a pinned window stays above a window focused later, which still gets focus', async () => {
		await manager.open( cfg( 'a' ) );
		await manager.open( cfg( 'b' ) );
		manager.setAlwaysOnTop( 'a', true );

		manager.focus( 'b' );

		expect( manager.getById( 'b' )!.isFocused() ).toBe( true );
		expect( z( manager, 'a' ) ).toBeGreaterThan( z( manager, 'b' ) );
		expect( onTop( manager, 'a' ) ).toBe( true );
		expect( onTop( manager, 'b' ) ).toBe( false );
	} );

	test( 'a window opened after pinning lands below the pinned one', async () => {
		await manager.open( cfg( 'a' ) );
		manager.setAlwaysOnTop( 'a', true );

		await manager.open( cfg( 'c' ) );

		expect( z( manager, 'a' ) ).toBeGreaterThan( z( manager, 'c' ) );
	} );

	test( 'unpinning restores normal stacking', async () => {
		await manager.open( cfg( 'a' ) );
		await manager.open( cfg( 'b' ) );
		manager.setAlwaysOnTop( 'a', true );
		manager.focus( 'b' );
		expect( z( manager, 'a' ) ).toBeGreaterThan( z( manager, 'b' ) );

		manager.setAlwaysOnTop( 'a', false );
		manager.focus( 'b' );

		expect( onTop( manager, 'a' ) ).toBe( false );
		expect( z( manager, 'b' ) ).toBeGreaterThan( z( manager, 'a' ) );
	} );

	test( 'several pinned windows stack by focus among themselves, all above the rest', async () => {
		await manager.open( cfg( 'a' ) );
		await manager.open( cfg( 'b' ) );
		await manager.open( cfg( 'c' ) );
		manager.setAlwaysOnTop( 'a', true );
		manager.setAlwaysOnTop( 'b', true );

		manager.focus( 'c' );
		expect( z( manager, 'a' ) ).toBeGreaterThan( z( manager, 'c' ) );
		expect( z( manager, 'b' ) ).toBeGreaterThan( z( manager, 'c' ) );

		manager.focus( 'a' );
		expect( z( manager, 'a' ) ).toBeGreaterThan( z( manager, 'b' ) );

		manager.focus( 'b' );
		expect( z( manager, 'b' ) ).toBeGreaterThan( z( manager, 'a' ) );
		expect( z( manager, 'a' ) ).toBeGreaterThan( z( manager, 'c' ) );
	} );

	test( 'the flag survives a snapshot and restore round-trip', async () => {
		await manager.open( cfg( 'a' ) );
		await manager.open( cfg( 'b' ) );
		manager.setAlwaysOnTop( 'a', true );
		manager.focus( 'b' );

		const session: Session = manager.snapshot();
		for ( const w of manager.getAll() ) {
			w.destroy();
		}
		desktop.remove();

		desktop = makeDesktop();
		document.body.appendChild( desktop );
		manager = new WindowManager( desktop ) as OnTopManager;
		const config = {
			adminUrl: `${ ORIGIN }/wp-admin/`,
			currentPage: `${ ORIGIN }/wp-admin/`,
			currentTitle: 'Dashboard',
			currentIcon: 'dashicons-dashboard',
			dockItems: [],
			session,
		} as unknown as DesktopConfig;

		await restoreSession( manager, config, desktop );

		expect( manager.getAll().map( ( w ) => w.id ).sort() ).toEqual( [ 'a', 'b' ] );
		expect( onTop( manager, 'a' ) ).toBe( true );
		expect( onTop( manager, 'b' ) ).toBe( false );
		expect( manager.getById( 'b' )!.isFocused() ).toBe( true );
		expect( z( manager, 'a' ) ).toBeGreaterThan( z( manager, 'b' ) );
	} );
} );
