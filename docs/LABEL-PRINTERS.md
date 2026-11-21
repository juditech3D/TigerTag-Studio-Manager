# Label printers

Studio prints spool and product labels from the label card (`renderer/labels/`). Besides the
system print dialog and PDF / PNG / SVG, **Print** can go straight to a label printer, with no
dialog and no driver. The card's **Printer** list offers:

| Line | Route | Code |
|------|-------|------|
| System dialog | the operating system's print dialog | `main.js` `label:render` |
| Marklife P15 | Bluetooth LE, Marklife "L11" protocol | `renderer/labels/p15.js` |
| `<name> · network` | a Brother QL found on the network (mDNS), raw raster on TCP 9100 | `services/label-printers.js` |
| `<name> · installed` | a printer installed on the computer, printed silently through its driver; an installed Brother QL is printed like a network one, at the address behind its Windows port or the one typed in **Address** | `main.js` `label:printers` |

Picking a printer picks its template: **Marklife P15** (30 × 12 mm) for the P15, **Brother 62 × 29**
for a Brother QL, or the template last printed on that printer. Templates the printer's roll cannot
take are greyed out.

## Brother QL (network)

- The search listens on every network interface of the computer (a VPN or Hyper-V adapter would
  otherwise hide the printer).
- **Roll**: Studio asks the printer which roll it holds (SNMP v1, `prtInputMediaName`) and fills
  the **Roll** list and the template with it. A QL-580N answers that question but no raster status
  request over the network. When the printer says nothing, pick the roll by hand: a job sent for the
  wrong roll puts the printer in error.
- **The printer is in error** (error light on, nothing prints): press its **Power** button once to
  clear the error, then print again. The card says so: it reads the printer's state over SNMP and
  shows "In error" or "Ready". On a QL-580N, `ESC @` on the raw port does not clear it, and a Printer MIB
  reset (`prtGeneralReset`) was not seen to restart it either.

## Marklife P15 (Bluetooth)

- The computer needs a Bluetooth adapter with **Bluetooth Low Energy** enabled. On Windows, a CSR8510
  dongle (USB ID `0A12:0001`, such as the Sena UD100) may have Low Energy switched off by Windows: the
  System log then shows BTHUSB event 30 ("The local adapter does not support an important Low Energy
  controller state"). No driver changes that; use another adapter (Bluetooth 5, Realtek or Intel).
  Windows runs one Bluetooth adapter at a time (BTHUSB event 6): unplug the old one, then replug the
  new one.
- Close the Marklife phone app first: the printer takes one connection at a time.
- Click **Connect** in the card. The printers seen are listed; one whose name is not a Marklife one
  can be picked by hand.
