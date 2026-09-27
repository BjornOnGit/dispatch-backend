CREATE TABLE orders (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  customer_id CHAR(36) NOT NULL,
  vendor_id CHAR(36) NOT NULL,
  rider_id CHAR(36) NULL,
  status ENUM('placed', 'vendor_accepted', 'rider_assigned', 'picked_up', 'delivered', 'cancelled') NOT NULL DEFAULT 'placed',
  total_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  FOREIGN KEY (rider_id) REFERENCES riders(id)
);