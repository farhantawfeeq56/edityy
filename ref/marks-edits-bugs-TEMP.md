# Marks and edits bugs (TEMP)

Short bug list only. No fix steps.

## Numbers (1, 2, 3 badges)

1. Numbers never restart after exit or agent clear. Empty canvas starts at 4, not 1.
2. Deleted edits leave gaps (1, 3). Users ask where 2 went.
3. Canvas numbers differ from agent Markdown numbers. Agent edits the wrong element.
4. Toolbar badge count differs from highest canvas number.
5. Marks mint on view, not on edit. Order follows render order, not creation order.
6. Canvas shows marks the panel hides (preview and variation waits).
7. Eye (hold-to-see-original) keeps the mark while pixels show the original.
8. Removed or zero-size edits burn a number but draw no badge.
9. Marks sit centered and cover content. Nested marks stack with no offset.
10. Duplicate numbers possible after reload. Cards target the wrong element.

## Panel

11. Panel rebuild drops Notes field focus and scroll on every change.
12. Typing digits in Notes switches variants instead of typing.

## Undo

13. Undo of typed words flattens links and markup inside the paragraph.
14. Undo right after typing is unpredictable (browser undo vs Edityy undo).
15. Undo of a move returns the element but the edit stays listed.

## Save and handoff

16. Reload restores draft edits the agent file never received.
17. Partial agent preview looks complete but sends unlanded targets on Keep.
18. Re-render can attach an edit to the wrong sibling.
19. Clearing many edits repaints once per edit (slow tear-down).
