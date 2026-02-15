import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: 'dashboard',
})
export class DashboardGateway {
    @WebSocketServer()
    server: Server;

    emitDashboardUpdate() {
        this.server.emit('dashboard-update');
    }
}
