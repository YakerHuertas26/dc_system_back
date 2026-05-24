# DC_System — Frontend

Interfaz web del sistema de gestión comercial DC_System. Construida con Next.js y Tailwind CSS, consume la API REST del backend para gestionar ventas, productos, inventario y usuarios.

---

## 🛠 Stack tecnológico

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Axios](https://img.shields.io/badge/Axios-5A29E4?style=for-the-badge&logo=axios&logoColor=white)

---

## ✨ Funcionalidades

- 🔐 **Autenticación** — login con JWT, rutas protegidas por rol
- 📦 **Gestión de productos** — listado, creación, edición y eliminación
- 🏪 **Registro de ventas** — formulario de ventas con detalle por producto
- 📊 **Control de inventario** — visualización de stock actualizado
- 👥 **Administración de usuarios** — gestión de cuentas y roles (vista admin)
- 📱 **Diseño responsive** — interfaz adaptada a móvil, tablet y desktop

---

## 📁 Estructura del proyecto

```
src/
├── app/
│   ├── (auth)/         # Páginas de login y registro
│   ├── dashboard/      # Panel principal
│   ├── products/       # Módulo de productos
│   ├── sales/          # Módulo de ventas
│   ├── inventory/      # Módulo de inventario
│   └── users/          # Módulo de usuarios (admin)
├── components/         # Componentes reutilizables
├── lib/                # Configuración de Axios e instancias
└── types/              # Tipos e interfaces TypeScript
```

---

## 🚀 Instalación y uso local

### Requisitos previos
- Node.js 18+
- Backend de DC_System corriendo en local ([ver instrucciones](https://github.com/YakerHuertas26))

### 1. Clonar el repositorio

```bash
git clone https://github.com/YakerHuertas26/dc-system-frontend.git
cd dc-system-frontend
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 4. Correr el proyecto

```bash
# Modo desarrollo
npm run dev

# Build de producción
npm run build
npm run start
```

La app estará disponible en `http://localhost:3001`

---

## 📸 Capturas de pantalla

> 🚧 Próximamente — el proyecto está en desarrollo activo.

---

## 🔗 Repositorio backend

👉 [dc-system-backend](https://github.com/YakerHuertas26)

---

## 👤 Autor

**Yaker Mayanga Huertas**
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=flat&logo=linkedin&logoColor=white)](https://linkedin.com/in/yaker-huertas)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat&logo=github&logoColor=white)](https://github.com/YakerHuertas26)
