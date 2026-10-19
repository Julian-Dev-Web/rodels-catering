export function discountBasisPoints(value:string,minBps=0,maxBps=10000) {
  const text=value.trim(),percent=Number(text)
  if(!/^\d{1,3}(?:\.\d{1,2})?$/.test(text)||!Number.isFinite(percent))throw Error('Enter a percentage with at most two decimal places.')
  const bps=Math.round(percent*100)
  if(bps<minBps||bps>maxBps)throw Error(`Choose a percentage from ${minBps/100}% to ${maxBps/100}%.`)
  return bps
}
export function stockQuantity(value:string,allowZero=false) {
  if(!/^\d+$/.test(value.trim()))throw Error('Enter a whole number of chairs.')
  const quantity=Number(value)
  if(!Number.isSafeInteger(quantity)||quantity<(allowZero?0:1)||quantity>1000000)throw Error(`Enter ${allowZero?'0':'1'} to 1,000,000 chairs.`)
  return quantity
}
