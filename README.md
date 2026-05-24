# DC_System — Backend

API REST para el sistema de gestión comercial DC_System. Construida con NestJS y MySQL, gestiona ventas, productos, inventario y usuarios con autenticación segura mediante JWT.

---

## 🛠 Stack tecnológico

![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![TypeORM](https://img.shields.io/badge/TypeORM-FE0803?style=for-the-badge&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logoColor=white)

---

## ✨ Funcionalidades

- 🔐 **Autenticación y autorización** — registro, login y manejo de roles con JWT
- 📦 **Gestión de productos** — CRUD completo con categorías y precios
- 🏪 **Gestión de ventas** — registro de transacciones y detalle de ventas
- 📊 **Control de inventario** — seguimiento de stock y movimientos
- 👥 **Gestión de usuarios** — administración con roles diferenciados (admin / usuario)
- 🔒 **Validación de datos** — validación de entrada con Zod en cada endpoint

---

## 📁 Estructura del proyecto

```
src/
├── Modules
    ├── auth/               # Autenticación JWT y guards
    ├── categories/         # Módulo de categorías
    ├── colors/             # Módulo de colores
    ├── product_statres/    # Módulo de estado de productos
    ├── products/           # Módulo de productos
    ├── roles/              # Módulo de roles
    ├── suppliers/          # Módulo de proveedores
    ├── users/              # Módulo de usuarios
    └── main.ts             # Punto de entrada

```
---

## 🚀 Instalación y uso local

### Requisitos previos
- Node.js 18+
- MySQL 8+

### 1. Clonar el repositorio

```bash
git clone https://github.com/YakerHuertas26/dc-system-backend.git
cd dc-system-backend
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# Base de datos
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=tu_usuario
DB_PASSWORD=tu_contraseña
DB_NAME=dc_system

# JWT
JWT_SECRET=tu_jwt_secret
JWT_EXPIRES_IN=7d

# App
PORT=3000
```

### 4. Crear la base de datos

```bash
mysql -u root -p
CREATE DATABASE dc_system;
```

### 5. Correr el proyecto

```bash
# Modo desarrollo
npm run start:dev

# Modo producción
npm run start:prod
```

La API estará disponible en `----`

---

## 📌 Endpoints principales

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/login` | Login y obtención de token |
| GET | `/products` | Listar productos |
| POST | `/products` | Crear producto |
| GET | `/categories` | Listar categorías |
| GET | `/users` | Listar usuarios (admin) |

---

## 🔗 Repositorio frontend

👉 [dc-system-frontend](https://github.com/YakerHuertas26/dc_system_front/tree/feature_v1)

---

## 👤 Autor

**Yaker Mayanga Huertas**
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=flat&logo=linkedin&logoColor=white)](https://linkedin.com/in/yaker-huertas)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat&logo=github&logoColor=white)](https://github.com/YakerHuertas26)
