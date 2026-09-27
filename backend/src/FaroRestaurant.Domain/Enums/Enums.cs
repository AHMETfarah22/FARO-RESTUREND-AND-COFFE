namespace FaroRestaurant.Domain.Enums;

public enum TableStatus { Available, Occupied, Reserved, Cleaning, Disabled }

public enum OrderStatus { Pending, Confirmed, Preparing, Ready, Served, Completed, Cancelled }

public enum OrderSource { Staff, QrMenu }

public enum PaymentStatus { Pending, Paid, Failed, Refunded }

public enum PaymentMethod { Cash, Card, Online, Test }

public enum ReservationStatus { Pending, Confirmed, Arrived, Completed, Cancelled }

public enum NotificationType { NewOrder, Reservation, LowStock, Payment, System }

public enum InventoryTransactionType { StockIn, StockOut, Adjustment }
