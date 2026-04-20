import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Componente que captura errores no controlados en la aplicación.
 * En desarrollo muestra detalles técnicos del error.
 * En producción muestra un mensaje genérico sin exponer información sensible.
 */
export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Registrar el error completo en consola (solo visible en DevTools)
        console.error('Error no controlado:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            // Detectar si estamos en modo desarrollo
            const isDev = import.meta.env?.DEV ?? false;

            return (
                <div className="p-4 bg-red-50 text-red-800 h-screen flex flex-col items-center justify-center">
                    <h1 className="text-2xl font-bold mb-4">Algo salió mal</h1>

                    {isDev ? (
                        // En desarrollo: mostrar detalles técnicos para depuración
                        <pre className="bg-white p-4 rounded shadow overflow-auto max-w-full text-sm">
                            {this.state.error?.toString()}
                            {'\n'}
                            {this.state.error?.stack}
                        </pre>
                    ) : (
                        // En producción: mensaje genérico sin detalles internos
                        <p className="text-gray-600 max-w-md text-center">
                            Ha ocurrido un error inesperado. Por favor, reinicia la aplicación.
                            Si el problema persiste, contacta con el soporte.
                        </p>
                    )}

                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                        Recargar aplicación
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
