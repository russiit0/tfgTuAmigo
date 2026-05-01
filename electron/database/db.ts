import mongoose from 'mongoose';

export async function connectDB() {
  try {
    const uri = 'mongodb://localhost:27017/tuamigo';
    await mongoose.connect(uri);
    console.log('✅ Conectado a MongoDB en', uri);
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    // En producción podríamos no salir de la app, pero loggear el error
  }
}
