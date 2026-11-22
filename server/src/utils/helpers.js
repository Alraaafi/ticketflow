const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Row index -> letter label: 0 -> A, 25 -> Z */
const rowLabel = (index) => String.fromCharCode(65 + index);

const rowIndex = (label) => String(label).toUpperCase().charCodeAt(0) - 65;

const roundMoney = (n) => Math.round(n * 100) / 100;

module.exports = { escapeRegex, rowLabel, rowIndex, roundMoney };
