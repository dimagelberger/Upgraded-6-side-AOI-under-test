const arr = [
  { val: 10, label: 'A' },
  { val: 20, label: 'B' },
  { val: NaN, label: 'C' },
  { val: 5, label: 'D' },
  { val: 25, label: 'E' },
];

arr.sort((a, b) => a.val - b.val);
console.log(arr);
