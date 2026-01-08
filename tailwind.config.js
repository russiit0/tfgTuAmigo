/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                calm: {
                    blue: {
                        light: '#E3F2FD',
                        primary: '#2196F3',
                    },
                    green: {
                        light: '#E8F5E9',
                    },
                    text: {
                        primary: '#37474F',
                    }
                }
            }
        },
    },
    plugins: [],
}
