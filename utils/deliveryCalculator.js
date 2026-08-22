/**
 * Working Days Delivery Calculator (12–15 Working Days)
 * Working days = Monday to Friday (excludes Saturday and Sunday)
 * Calculates from the actual order date (order.createdAt)
 * Example: "08 Sep 2026 - 11 Sep 2026"
 */

function addWorkingDays(startDate, daysToAdd) {
  const date = new Date(startDate);
  if (isNaN(date.getTime())) return new Date();
  let count = 0;
  while (count < daysToAdd) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay(); // 0 is Sun, 6 is Sat
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }
  return date;
}

function formatDeliveryDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function calculateEstimatedDelivery(orderDate) {
  const base = orderDate ? new Date(orderDate) : new Date();
  const safeDate = isNaN(base.getTime()) ? new Date() : base;

  const earliestDate = addWorkingDays(safeDate, 12);
  const latestDate = addWorkingDays(safeDate, 15);

  return `${formatDeliveryDate(earliestDate)} - ${formatDeliveryDate(latestDate)}`;
}

module.exports = {
  addWorkingDays,
  formatDeliveryDate,
  calculateEstimatedDelivery
};
