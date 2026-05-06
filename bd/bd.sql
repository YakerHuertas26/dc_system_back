
drop schema if exists `dc_system`;
create schema if not exists `dc_system` default character set utf8mb4 collate utf8mb4_unicode_ci ;
use `dc_system`;

/*creación de tablas */
create table if not exists roles (
	role_id int auto_increment primary key,
    name varchar(45) not null unique
 ) ENGINE=InnoDB;

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

create table if not exists suppliers(
	supplier_id int auto_increment primary key,
    name varchar(45) not null unique,
    ruc varchar(11) not null unique,
    phone varchar(9),
    bank_account varchar(25),
    state tinyint(1) not null default 1
) ENGINE=InnoDB;

create table if not exists categories(
	category_id int auto_increment primary key,
    code varchar(4) null unique,
    name varchar(45) not null unique,
    state tinyint(1) not null default 1
) ENGINE=InnoDB;

create table if not exists product_states(
	product_state_id auto_increment primary key,
    name varchar(45) not null
)ENGINE=InnoDB;

create table if not exists products (
	product_id int auto_increment primary key,
    code varchar(8) null unique,
    name varchar(45) not null unique,
    description text,
    purchase_price decimal(10,2) not null,
    sale_price decimal(10,2) not null,
    clearance_price decimal(10,2) null,
    category_id int not null,
    product_state_id int not null,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    constraint fk_products_category foreign key( category_id) references categories(category_id) on update cascade on delete restrict,
    constraint fk_products_state foreign key(product_state_id) references product_states(product_state_id) on update cascade on delete restrict
)ENGINE=InnoDB;

create table if not exists colors(
	color_id int auto_increment primary key,
    name varchar(45) not null unique,
    code varchar(7) not null unique
)ENGINE= InnoDB;

create table if not exists product_colors(
    state tinyint(1) not null default 1,
    product_id int not null,
    color_id int not null,
    primary key(product_id,color_id),
    constraint fk_pc_product foreign key(product_id) references products(product_id) on update cascade on delete restrict,
    constraint fk_pc_color foreign key(color_id) references colors(color_id) on update cascade on delete restrict
)ENGINE= InnoDb;

create table if not exists images(
	image_id int auto_increment primary key,
    rute mediumtext not null,
    product_id int not null,
    color_id int null,
    constraint fk_images_pc foreign key( product_id) references products(product_id) on update cascade on delete restrict,
    constraint fk_color_pc foreign key( color_id) references colors(color_id) on update cascade on delete restrict
)ENGINE= InnoDb;

create table if not exists product_stocks(
	product_id int not null,
    quantity int not null,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    constraint fk_ps_product foreign key(product_id) references products(product_id) on update cascade on delete restrict
)ENGINE= InnoDb;

create table if not exists product_color_stock(
	product_id int not null,
    color_id int not null,
    quantity int not null default 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    primary key(product_id,color_id),
    constraint fk_product_stock foreign key(product_id,color_id) references product_colors(product_id, color_id) on update cascade on delete restrict
)ENGINE= InnoDb;

create table if not exists movement_types(
	movement_type_id int auto_increment primary key,
    name varchar(45) not null
)ENGINE= InnoDb;

create table if not exists stock_movements(
	 stock_movement_id int auto_increment primary key,
     quantity int not null, 
     description varchar(150), 
     movement_date datetime not null DEFAULT CURRENT_TIMESTAMP,
     product_id int not null,
     color_id int null,
     movement_type_id int not null,
     user_id int not null,
     created_at datetime default CURRENT_TIMESTAMP,
     constraint fk_sm_user foreign key(user_id) references users(user_id) on update cascade on delete restrict,
     constraint fk_sm_type foreign key(movement_type_id) references movement_types(movement_type_id) on update cascade on delete restrict,
	constraint fk_sm_product foreign key (product_id) REFERENCES products(product_id) on update cascade on delete restrict,
	constraint fk_sm_color FOREIGN KEY (color_id) REFERENCES colors(color_id)  on update cascade on delete restrict
)ENGINE= InnoDb;
CREATE INDEX idx_sm_date_ ON stock_movements(movement_date);
CREATE INDEX idx_sm_product ON stock_movements(product_id);

create table if not exists payment_methods(
	payment_method_id int auto_increment primary key,
    name varchar(45) not null unique
)ENGINE= InnoDb;

create table if not exists  payment_types(
	payment_type_id int auto_increment primary key,
    name varchar(45) not null unique 
)ENGINE= InnoDb;

create table if not exists  payment_states(
	payment_state_id int auto_increment primary key,
    name varchar(45) not null unique 
)ENGINE= InnoDb;

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

create table if not exists purchase_details(
 purchase_detail_id int auto_increment primary key,
 quantity int not null,
 unit_price decimal(10,2) not null,
 subtotal DECIMAL(10,2) AS (quantity * unit_price) STORED,
 purchase_id int not null,
 product_id int not null,
 constraint fk_pd_purchase foreign key(purchase_id) references purchases(purchase_id) on update cascade on delete restrict,
 constraint fk_pd_product foreign key(product_id) references products(product_id) on update cascade on delete restrict 
);

create table if not exists customers(
	customer_id int auto_increment primary key,
    name varchar(45) not null,
    phone varchar(9) null
)ENGINE= InnoDb;
create index idx_customer_name on customers(name);

create table if not exists orders(
	order_id int auto_increment primary key,
    order_date datetime default CURRENT_TIMESTAMP,
    total_amount decimal(10,2) not null,
    remaining_balance decimal(10,2) default 00.0, 
    customer_id int not null,
    user_id int not null,
    payment_state_id int not null,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    constraint fk_order_customer foreign key(customer_id) references customers(customer_id) on update cascade on delete restrict,
    constraint fk_order_user foreign key(user_id) references users(user_id) on update cascade on delete restrict,
    constraint fk_order_pstate foreign key(payment_state_id) references payment_states(payment_state_id) on update cascade on delete restrict
);
create index idx_order_date on orders(order_date);

create table if not exists order_details(
	order_detail_id int auto_increment primary key,
    quantity int not null,
    unit_price decimal(10,2) not null,
    subtotal decimal(10,2) as (quantity * unit_price) STORED,
    order_id int not null,
    product_id int not null,
    color_id int null,
    constraint fk_od_order foreign key(order_id) references orders(order_id) on update cascade on delete restrict,
    constraint fk_od_product foreign key(product_id) references products(product_id) on update cascade on delete restrict,
    constraint fk_od_color foreign key(color_id) references colors(color_id) on update cascade on delete restrict
)ENGINE= InnoDb;

CREATE TABLE cash_register (
    cash_register_id INT AUTO_INCREMENT PRIMARY KEY,
    opening_amount DECIMAL(10,2) NOT NULL,
    closing_amount DECIMAL(10,2) DEFAULT 0,
    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME NULL,
    status ENUM('OPEN','CLOSED') DEFAULT 'OPEN',
    user_id INT NOT NULL,

    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE cash_movements (
    cash_movement_id INT AUTO_INCREMENT PRIMARY KEY,
    movement_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    amount DECIMAL(10,2) NOT NULL,
    movement_type ENUM('IN','OUT') NOT NULL,
    payment_method_id INT NOT NULL,
    description VARCHAR(150),
    cash_register_id INT NOT NULL,
    user_id INT NOT NULL,
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(payment_method_id)  on update cascade on delete restrict,
    FOREIGN KEY (cash_register_id) REFERENCES cash_register(cash_register_id)  on update cascade on delete restrict,
    FOREIGN KEY (user_id) REFERENCES users(user_id)  on update cascade on delete restrict
);

CREATE TABLE payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    payment_method_id INT NOT NULL,
    user_id INT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)on update cascade on delete restrict,
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(payment_method_id)on update cascade on delete restrict,
    FOREIGN KEY (user_id) REFERENCES users(user_id)on update cascade on delete restrict
);