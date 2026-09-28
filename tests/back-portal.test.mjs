import test from 'node:test';
import assert from 'node:assert/strict';
import { BackPortal } from '../dist/back-portal.js';

test('BackPortal: initialization and defaults', () => {
  const portal = new BackPortal({
    width: 1440,
    height: 900,
    mapNames: ['Trung Quốc', 'Hy Lạp', 'Pháp', 'Đức', 'Anh', 'Ý']
  });

  assert.equal(portal.width, 1440);
  assert.equal(portal.height, 900);
  assert.equal(portal.mapNames.length, 6);
  assert.equal(portal.position.x, 1440 * 0.28);
  assert.equal(portal.position.y, 900 * 0.90);
  assert.equal(portal.spawnPoint.x, 1440 * 0.5);
  assert.equal(portal.spawnPoint.y, 900 * 0.82);
});

test('BackPortal: visibility rules', () => {
  const portal = new BackPortal({ width: 1440, height: 900, mapNames: ['China', 'Greece', 'France'] });
  assert.equal(portal.isVisible(0), false, 'Map 0 has no back portal');
  assert.equal(portal.isVisible(1), true, 'Map 1 has back portal');
  assert.equal(portal.isVisible(2), true, 'Map 2 has back portal');
  assert.equal(portal.isVisible(3), false, 'Out of bounds map has no portal');
  assert.equal(portal.isVisible(-1), false, 'Negative index has no portal');
});

test('BackPortal: collision detection and triggering', () => {
  const portal = new BackPortal({
    width: 1440,
    height: 900,
    mapNames: ['Trung Quốc', 'Hy Lạp', 'Pháp', 'Đức', 'Anh', 'Ý']
  });

  // Spawn position should NOT trigger
  assert.equal(portal.contains(portal.spawnPoint, 1), false, 'Spawn point must be outside portal');

  // Trigger position: near x = 1440 * 0.28 (403.2), y > 900 * 0.87 (783)
  const insidePlayer = { x: 403, y: 800 };
  assert.equal(portal.contains(insidePlayer, 1), true, 'Player inside portal trigger zone');
  assert.equal(portal.contains(insidePlayer, 0), false, 'Never triggers on map 0');

  // Player far to the right
  const outsidePlayer = { x: 700, y: 800 };
  assert.equal(portal.contains(outsidePlayer, 1), false, 'Outside portal bounds');
});

test('BackPortal: update lifecycle and changeMap callback', () => {
  const portal = new BackPortal({
    width: 1440,
    height: 900,
    mapNames: ['Trung Quốc', 'Hy Lạp', 'Pháp']
  });

  let transitionedTo = -1;
  const changeMap = (target) => {
    transitionedTo = target;
    return true;
  };

  const insidePlayer = { x: 403, y: 800 };

  // Step into portal from map 2 (France) -> should change to map 1 (Greece)
  const switched = portal.update({
    player: insidePlayer,
    mapIndex: 2,
    dt: 0.016,
    changeMap
  });

  assert.equal(switched, true);
  assert.equal(transitionedTo, 1, 'Should navigate to previous map');

  // Immediate next frame while still inside: should not trigger repeatedly
  const switchedAgain = portal.update({
    player: insidePlayer,
    mapIndex: 1,
    dt: 0.016,
    changeMap
  });
  assert.equal(switchedAgain, false, 'Must not retrigger while still inside');

  // Step out to spawn point
  portal.update({
    player: portal.spawnPoint,
    mapIndex: 1,
    dt: 0.3,
    changeMap
  });

  // Cooldown still active (< 0.5s)
  const quickReenter = portal.update({
    player: insidePlayer,
    mapIndex: 1,
    dt: 0.1,
    changeMap
  });
  assert.equal(quickReenter, false, 'Cooldown should block premature retrigger');

  // Elapse remaining cooldown
  portal.update({
    player: portal.spawnPoint,
    mapIndex: 1,
    dt: 0.3,
    changeMap
  });

  // Step into portal again from map 1 -> should navigate to map 0
  const switchedToChina = portal.update({
    player: insidePlayer,
    mapIndex: 1,
    dt: 0.016,
    changeMap
  });
  assert.equal(switchedToChina, true);
  assert.equal(transitionedTo, 0, 'Should navigate to map 0');
});
