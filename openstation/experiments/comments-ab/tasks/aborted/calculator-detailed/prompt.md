Add a basic Calculator app to OpenStation. It opens as a native window from the dock and from a desktop shortcut, and any signed-in user who can read the site can use it. It is a basic calculator, not a scientific one: a large four-column keypad with the digits, a decimal point, + − × ÷, =, %, ± (change sign), backspace and AC (clear), above a readout that screen readers announce. All arithmetic runs in the browser; pressing a key never sends a request.

How it behaves:

- Operations run left to right as they are entered: `2 + 3 × 4 =` gives 20. Choosing another operator before typing the next number replaces the pending one.
- Pressing = again repeats the last operation: `5 + 2 = =` gives 9. Typing a digit after = starts a new calculation.
- After + or −, % takes that percentage of the first number: `200 + 10 % =` gives 220. Otherwise % divides the number on the readout by 100: `50 %` gives 0.5, `200 × 10 % =` gives 20.
- Results hide binary rounding noise: `0.1 + 0.2 =` gives 0.3. A second decimal point in the same number is ignored. Entry stops at 12 digits, and results are rounded to 12 significant digits.
- Dividing by zero shows `Error`; typing a digit or pressing AC starts again.
- The readout shows plain numbers: a leading `-` for negatives, `.` as the decimal point, no thousands separators.
- While the calculator has focus, the keyboard works too: digits, `+ - * / . % =`, Enter for =, Backspace, and Delete or Escape for AC. Keys typed in other windows never reach it, and shortcuts with Ctrl, Cmd or Alt keep their normal behaviour.

Keep the arithmetic in a pure module, `apps/calculator/parts/engine.ts`, exporting `initialState()` and `pressKey( state, key )`. `pressKey` returns a new state and leaves the one it was given untouched; `key` is one of `'0'`–`'9'`, `'.'`, `'+'`, `'-'`, `'*'`, `'/'`, `'='`, `'%'`, `'sign'`, `'backspace'`, `'clear'`; and `state.display` is exactly what the readout shows. The calculator window's state is that same state object.

Follow the repository's contributor guide for the workflow. Do not start Docker or wp-env; the PHP test suite is out of scope for this task. When you are done, reply with a short summary of what you changed and which checks you ran.
