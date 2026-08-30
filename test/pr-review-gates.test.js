import { test } from 'node:test';
import assert from 'node:assert/strict';

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function confidence(passes, high){ return clamp(3+passes-high,0,5); }
function shouldFail(confidence, required){ return confidence < required; }
function autoApprove({enabled, confidence, risk, maxRisk, unresolved}){
  const order={Low:0, Medium:1, High:2, Critical:3};
  return enabled && confidence===5 && order[risk]<=order[maxRisk] && !unresolved;
}

test('confidence clamp and required gate', () => {
  assert.equal(confidence(1,0), 4);
  assert.equal(confidence(1,5), 0);
  assert.equal(confidence(1,1), 3);
  assert.ok(shouldFail(1,2));
  assert.ok(!shouldFail(2,2));
  assert.ok(!shouldFail(5,0));
});

test('auto-approve truth table (needs 5/5 + risk cap)', () => {
  assert.ok(autoApprove({enabled:true, confidence:5, risk:'Low', maxRisk:'Low', unresolved:false}));
  assert.ok(!autoApprove({enabled:false, confidence:5, risk:'Low', maxRisk:'Low', unresolved:false}));
  assert.ok(!autoApprove({enabled:true, confidence:4, risk:'Low', maxRisk:'Low', unresolved:false}));
  assert.ok(!autoApprove({enabled:true, confidence:5, risk:'High', maxRisk:'Low', unresolved:false}));
  assert.ok(autoApprove({enabled:true, confidence:5, risk:'High', maxRisk:'High', unresolved:false}));
  assert.ok(!autoApprove({enabled:true, confidence:5, risk:'Low', maxRisk:'Low', unresolved:true}));
});

test('risk enum order', ()=>{
  const order={Low:0, Medium:1, High:2, Critical:3};
  assert.ok(order.Low < order.Medium);
  assert.ok(order.High < order.Critical);
});
