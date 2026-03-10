// components/NotificationList.jsx
export default function NotificationList({ notifications }) {
  const safeNotifications = Array.isArray(notifications) ? notifications : [];

  return (
    <div>
      <h3>Notifications</h3>
      <ul>
        {safeNotifications.map((n, i) => (
          <li key={i}>{n.message}</li>
        ))}
      </ul>
    </div>
  );
}
