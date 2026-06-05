drop schema if exists `dc_system`;
create schema if not exists `dc_system` 
default character set utf8mb4 
collate utf8mb4_unicode_ci ;
use `dc_system`;

-- ------------------------------------------------------------
-- roles
-- ------------------------------------------------------------
create table if not exists roles (
	role_id int auto_increment primary key,
    name varchar(45) not null unique
) ENGINE=InnoDB;
-- -------------------------------------------------------------
insert into roles (name) value ("Admin"),("Vendedor");
-- ------------------------------------------------------------
-- users
-- ------------------------------------------------------------
create table if not exists users(
	user_id int auto_increment primary key,
    name varchar(45) not null,
    email varchar(50) not null unique,
    password varchar(255) not null,
    state tinyint(1) not null default 1,
    role_id int not null, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    constraint fk_users_roles foreign key (role_id) references roles(role_id)
    on update cascade on delete restrict
) ENGINE=InnoDB;
-- ------------------------------------------------------------
insert into users (name,email,password,state, role_id)
value ("Carol","carol@gmail.com","$2b$10$oyCWLAktChwO5raCYXXJHOMwlMGQ2X/h3WlTGOBhqH6IgNQoW/x0S",1,1);
-- ------------------------------------------------------------
-- suppliers // proveedores
-- ------------------------------------------------------------
create table if not exists suppliers(
	supplier_id int auto_increment primary key,
    name varchar(45) not null unique,
    ruc varchar(11) not null unique,
    phone varchar(9),
    bank_account varchar(20),
    state tinyint(1) not null default 1
) ENGINE=InnoDB;
-- ------------------------------------------------------------
-- categories
-- ------------------------------------------------------------
create table if not exists categories(
	category_id int auto_increment primary key,
    code varchar(4) null unique,
    name varchar(45) not null unique,
    state tinyint(1) not null default 1
) ENGINE=InnoDB;
-- ------------------------------------------------------------
-- product_states // estado del producto
-- ------------------------------------------------------------
create table if not exists product_states(
	product_state_id int auto_increment primary key,
    name varchar(45) not null
) ENGINE=InnoDB;
-- ------------------------------------------------------------
insert into product_states(name) value ("Nuevo"),("disponible"),("Liquidación"),("Agotado");
-- ------------------------------------------------------------
-- products
-- ------------------------------------------------------------
create table if not exists products (
	product_id int auto_increment primary key,
    code varchar(8) null unique,
    name varchar(45) not null unique,
    purchase_price decimal(10,2) not null,
    sale_price decimal(10,2) null,
    clearance_price decimal(10,2) null,
    has_colors TINYINT(1) NOT NULL DEFAULT 0,
    category_id int not null,
    product_state_id int not null default 1,
    description text,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    constraint fk_products_category foreign key( category_id) references categories(category_id) on update cascade on delete restrict,
    constraint fk_products_state foreign key(product_state_id) references product_states(product_state_id) on update cascade on delete restrict
)ENGINE=InnoDB;
-- ------------------------------------------------------------
-- colors
-- ------------------------------------------------------------
create table if not exists colors(
	color_id int auto_increment primary key,
    name varchar(45) not null unique,
    code varchar(7) not null unique
)ENGINE= InnoDB;
-- -----------------------------------------------------------------
INSERT INTO colors (name, code) VALUE ('Color genérico', '#fffff0');
-- ------------------------------------------------------------
-- product_colors
-- ------------------------------------------------------------
create table if not exists product_colors(
    product_color_id int auto_increment primary key,
    product_id int not null,
    color_id int not null  default 1,
    state tinyint(1) not null default 1,
    unique key uq_product_color(product_id, color_id),
    constraint fk_pc_product foreign key(product_id) references products(product_id) on update cascade on delete restrict,
    constraint fk_pc_color foreign key(color_id) references colors(color_id) on update cascade on delete restrict
)ENGINE= InnoDb;
-- ------------------------------------------------------------
-- images
-- ------------------------------------------------------------
create table if not exists images(
	image_id int auto_increment primary key,
    rute mediumtext not null,
    product_color_id int not null,
    constraint fk_images_pc foreign key( product_color_id) references product_colors(product_color_id) on update cascade on delete restrict
)ENGINE= InnoDb;
-- ------------------------------------------------------------
-- product_color_stock
-- ------------------------------------------------------------
create table if not exists product_color_stock(
	product_color_id int not null primary key,
    quantity int not null default 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    constraint fk_product_stock foreign key(product_color_id) references product_colors(product_color_id) on update cascade on delete restrict
)ENGINE= InnoDb;
-- ------------------------------------------------------------
-- movement_types / tipos de movimiento 
-- ------------------------------------------------------------
create table if not exists movement_types(
	movement_type_id int auto_increment primary key,
    name varchar(45) not null
)ENGINE= InnoDb;
-- ------------------------------------------------------------
insert into movement_types(name) value("Compra"),("Venta"),("Devolución");
-- ------------------------------------------------------------
-- stock_movements / movimientos de stock
-- ------------------------------------------------------------
create table if not exists stock_movements(
    stock_movement_id int auto_increment primary key,
    quantity int not null, 
    description varchar(150), 
    reference_id int not null,
    reference_type ENUM('Venta','Compra','Devolución') NOT NULL,
    movement_date datetime not null DEFAULT CURRENT_TIMESTAMP,
    product_color_id int not null,
    movement_type_id int not null,
    user_id int not null,
    created_at datetime default CURRENT_TIMESTAMP,
    constraint fk_sm_user foreign key(user_id) references users(user_id) on update cascade on delete restrict,
    constraint fk_sm_type foreign key(movement_type_id) references movement_types(movement_type_id) on update cascade on delete restrict,
    constraint fk_sm_pc foreign key (product_color_id) REFERENCES product_colors(product_color_id) on update cascade on delete restrict
)ENGINE= InnoDb;
CREATE INDEX idx_sm_date_ ON stock_movements(movement_date);
CREATE INDEX idx_sm_product ON stock_movements(product_color_id);
-- ------------------------------------------------------------
-- payment_methods / Metodo de pago 
-- ------------------------------------------------------------
create table if not exists payment_methods(
	payment_method_id int auto_increment primary key,
    name varchar(45) not null unique
)ENGINE= InnoDb;
-- ------------------------------------------------------------
insert into payment_methods(name) value("Efectivo"),("Yape"),("Tarjeta"),("Transferencia");
-- ------------------------------------------------------------
-- payment_types / Tipos de pago 
-- ------------------------------------------------------------
create table if not exists  payment_types(
	payment_type_id int auto_increment primary key,
    name varchar(45) not null unique 
)ENGINE= InnoDb;
-- ----------------------------------------------------------------------
insert into payment_types(name) value("Pago a contado"),("Pago a crédito");
-- ------------------------------------------------------------
-- payment_states // Estado de pago de una compra o venta
-- ------------------------------------------------------------
create table if not exists  payment_states(
	payment_state_id int auto_increment primary key,
    name varchar(45) not null unique 
)ENGINE= InnoDb;
-------------------------------------------------------------
insert into payment_states(name) value("Pagado"),("Pendiente");
-- ------------------------------------------------------------
-- purchases
-- ------------------------------------------------------------
create table if not exists purchases(
	purchase_id int auto_increment primary key,
    purchase_date datetime not null,
    total_amount decimal(10,2) not null,
    user_id int not null,
    supplier_id int not null,
    payment_method_id int not null,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    constraint fk_purchase_user foreign key(user_id) references users(user_id) on update cascade on delete restrict,
    constraint fk_purchase_supplier foreign key(supplier_id) references suppliers(supplier_id) on update cascade on delete restrict,
    constraint fk_purchase_paymetMethod foreign key(payment_method_id) references payment_methods(payment_method_id)on update cascade on delete restrict
)ENGINE= InnoDb;
CREATE INDEX idx_purchases_date ON purchases(purchase_date);
-- ------------------------------------------------------------
-- purchase_details
-- ------------------------------------------------------------
create table if not exists purchase_details(
    purchase_detail_id int auto_increment primary key,
    quantity int not null,
    unit_price decimal(10,2) not null,
    subtotal DECIMAL(10,2) AS (quantity * unit_price) STORED,
    purchase_id int not null,
    product_id int not null,
    constraint fk_pd_purchase foreign key(purchase_id) references purchases(purchase_id) on update cascade on delete restrict,
    constraint fk_pd_product foreign key(product_id) references products(product_id) on update cascade on delete restrict 
) ENGINE=InnoDB;
-- ------------------------------------------------------------
-- supplier_products
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier_products (
    supplier_product_id int auto_increment primary key,
    supplier_id INT  NOT NULL,
    product_id  INT   NOT NULL,
    unit_price  DECIMAL(10,2) NOT NULL,
    date_register DATETIME DEFAULT CURRENT_TIMESTAMP,
    state       TINYINT(1)    NOT NULL DEFAULT 1,
    UNIQUE KEY uq_supplier_product(supplier_id, product_id),
    CONSTRAINT fk_sp_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sp_product FOREIGN KEY (product_id) REFERENCES products(product_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;
-- ------------------------------------------------------------
-- customers
-- ------------------------------------------------------------
create table if not exists customers(
	customer_id int auto_increment primary key,
    name varchar(45) not null,
    phone varchar(9) null
)ENGINE= InnoDb;
create index idx_customer_name on customers(name);
-- ------------------------------------------------------------
-- orders
-- ------------------------------------------------------------
create table if not exists orders(
	order_id int auto_increment primary key,
    order_date datetime default CURRENT_TIMESTAMP,
    total_amount decimal(10,2) not null,
    customer_id int not null,
    user_id int not null,
    payment_state_id int not null,
    payment_type_id int not null,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    constraint fk_order_customer foreign key(customer_id) references customers(customer_id) on update cascade on delete restrict,
    constraint fk_order_user foreign key(user_id) references users(user_id) on update cascade on delete restrict,
    constraint fk_order_pstate foreign key(payment_state_id) references payment_states(payment_state_id) on update cascade on delete restrict,
    constraint fk_order_ptype foreign key(payment_type_id) references payment_types(payment_type_id) on update cascade on delete restrict
)ENGINE=InnoDB;
create index idx_order_date on orders(order_date);
-- ------------------------------------------------------------
-- orders_details
-- ------------------------------------------------------------
create table if not exists order_details(
	order_detail_id int auto_increment primary key,
    quantity int not null,
    unit_price decimal(10,2) not null,
    subtotal decimal(10,2) as (quantity * unit_price) STORED,
    order_id int not null,
    product_color_id INT NOT NULL,
    constraint fk_od_order foreign key(order_id) references orders(order_id) on update cascade on delete restrict,
    constraint fk_od_pc foreign key(product_color_id) references product_colors(product_color_id) on update cascade on delete restrict
)ENGINE= InnoDb;
-- ------------------------------------------------------------
-- Registro de abertura y cierre de caja
-- ------------------------------------------------------------
create table if not exists cash(
    cash_id int auto_increment primary key,
    name varchar(45) not null unique,
    state tinyint(1) not null default 1
)ENGINE= InnoDb;
-- ------------------------------------------------------------
-- cash_Sesion
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_sesions (
    cash_sesion_id INT AUTO_INCREMENT PRIMARY KEY,
    opening_amount DECIMAL(10,2) NOT NULL,
    closing_amount DECIMAL(10,2) NULL DEFAULT NULL,
    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME NULL,
    status ENUM('OPEN','CLOSED') DEFAULT 'OPEN',
    user_id INT NOT NULL,
    cash_id INT NOT NULL,
    CONSTRAINT fk_cs_user_id FOREIGN KEY (user_id) REFERENCES users(user_id)  on update cascade on delete restrict,
    CONSTRAINT fk_cs_cash_id FOREIGN KEY (cash_id) REFERENCES cash(cash_id)  on update cascade on delete restrict
)ENGINE= InnoDb;
-- ------------------------------------------------------------
-- Moviemiento de caja
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cash_movements (
    cash_movement_id INT AUTO_INCREMENT PRIMARY KEY,
    movement_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    amount DECIMAL(10,2) NOT NULL,
    reference_type ENUM('Compra','Venta', 'Gasto extra') NOT NULL,
    reference_id INT,
    payment_method_id INT NOT NULL,
    description VARCHAR(150),
    cash_sesion_id INT NOT NULL,
    user_id INT NOT NULL,
    CONSTRAINT fk_cm_payment_method_id FOREIGN KEY (payment_method_id) REFERENCES payment_methods(payment_method_id)  on update cascade on delete restrict,
    CONSTRAINT fk_cm_cash_sesion_id FOREIGN KEY (cash_sesion_id) REFERENCES cash_sesions(cash_sesion_id)  on update cascade on delete restrict,
    CONSTRAINT fk_cm_user_id FOREIGN KEY (user_id) REFERENCES users(user_id)  on update cascade on delete restrict
)ENGINE= InnoDb;
-- ------------------------------------------------------------
-- Payments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    payment_method_id INT NOT NULL,
    cash_sesion_id INT NOT NULL,
    user_id INT NOT NULL,
    CONSTRAINT fk_p_order_id FOREIGN KEY (order_id) REFERENCES orders(order_id)on update cascade on delete restrict,
    CONSTRAINT fk_p_payment_method_id FOREIGN KEY (payment_method_id) REFERENCES payment_methods(payment_method_id)on update cascade on delete restrict,
    CONSTRAINT fk_p_cash_sesion_id FOREIGN KEY (cash_sesion_id) REFERENCES cash_sesions(cash_sesion_id)  on update cascade on delete restrict,
    CONSTRAINT fk_p_user_id FOREIGN KEY (user_id) REFERENCES users(user_id)on update cascade on delete restrict
    )ENGINE= InnoDb;
-- ------------------------------------------------------------
-- dayly_balance
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_balance (
    daily_balance_id    INT AUTO_INCREMENT PRIMARY KEY,
    balance_date        DATE NOT NULL,
    payment_method_id   INT NOT NULL,
    expected_amount     DECIMAL(10,2) NOT NULL,  -- calculado del sistema
    actual_amount       DECIMAL(10,2) NOT NULL,  -- contado físicamente
    difference          DECIMAL(10,2) GENERATED ALWAYS AS 
                        (actual_amount - expected_amount) STORED,
    total_income        DECIMAL(10,2) NOT NULL,  -- total entradas del día
    total_expense       DECIMAL(10,2) NOT NULL,  -- total salidas del día
    closed_by           INT NOT NULL,            -- user_id quien cerró
    closed_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes               VARCHAR(255) NULL,
    cash_id              INT NOT NULL,
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(payment_method_id),
    FOREIGN KEY (closed_by) REFERENCES users(user_id),
    FOREIGN KEY (cash_id) REFERENCES cash(cash_id),
    UNIQUE KEY unique_daily_method (balance_date, payment_method_id, cash_id)
    
)ENGINE= InnoDb;
