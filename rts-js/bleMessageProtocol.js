/* Copyright (c) 2019-2020 Digital Dream Labs. See LICENSE file for details */

class BleMessageProtocol {
  constructor(maxSize) {
    this.kMsgStart = 0b10;
    this.kMsgContinue = 0b00;
    this.kMsgEnd = 0b01;
    this.kMsgSolo = 0b11;
    this.kMsgBits = 0b11 << 6;

    this.maxSize = maxSize;
    this.sendRawEvent;
    this.delegate;

    this.state = this.kMsgStart;
    this.buffer = [];
  }

  onSendRaw(fnc) {
    this.sendRawEvent = fnc;
  }

  setDelegate(delegate) {
    this.delegate = delegate;
  }

  receiveRawBuffer(buffer) {
    if (buffer.length < 1) {
      return;
    }

    let headerByte = buffer[0];
    let sizeByte = BleMessageProtocol.getSize(headerByte);
    let multipartState = BleMessageProtocol.getMultipartBits(headerByte);

    if (sizeByte != buffer.length - 1) {
      console.log("Size failure " + sizeByte + ", " + (buffer.length - 1));
      return;
    }

    switch (multipartState) {
      case this.kMsgStart: {
        if (this.state != this.kMsgStart) {
          // error
        }

        this.buffer = [];
        this.append(buffer);
        this.state = this.kMsgContinue;

        break;
      }
      case this.kMsgContinue: {
        if (this.state != this.kMsgContinue) {
          // error
        }

        this.append(buffer);
        this.state = this.kMsgContinue;
        break;
      }
      case this.kMsgEnd: {
        if (this.state != this.kMsgContinue) {
          // error
        }

        this.append(buffer);
        if (this.delegate != null) {
          this.delegate.handleReceive(this.buffer);
        }
        this.state = this.kMsgStart;
        break;
      }
      case this.kMsgSolo: {
        if (this.state != this.kMsgStart) {
          // error
        }

        if (this.delegate != null) {
          buffer.splice(0, 1);
          this.delegate.handleReceive(buffer);
        }
        this.state = this.kMsgStart;
        break;
      }
    }
  }

  sendMessage(buffer) {
    let sizeRemaining = buffer.length;

    if (buffer.length < this.maxSize) {
      this.sendRawMessage(this.kMsgSolo, buffer);
    } else {
      while (sizeRemaining > 0) {
        let offset = buffer.length - sizeRemaining;

        if (sizeRemaining == buffer.length) {
          let msgSize = this.maxSize - 1;
          this.sendRawMessage(
            this.kMsgStart,
            buffer.slice(offset, msgSize + offset)
          );
          sizeRemaining -= msgSize;
        } else if (sizeRemaining < this.maxSize) {
          this.sendRawMessage(
            this.kMsgEnd,
            buffer.slice(offset, sizeRemaining + offset)
          );
          sizeRemaining = 0;
        } else {
          let msgSize = this.maxSize - 1;
          this.sendRawMessage(
            this.kMsgContinue,
            buffer.slice(offset, msgSize + offset)
          );
          sizeRemaining -= msgSize;
        }
      }
    }
  }

  append(buffer) {
    this.buffer = this.buffer.concat(buffer.slice(1));
  }

  sendRawMessage(multipart, buffer) {
    let arr = [BleMessageProtocol.getHeaderByte(multipart, buffer.length)];

    let sendBuffer = arr.concat(buffer);

    if (this.sendRawEvent != null) {
      this.sendRawEvent(sendBuffer);
    }
  }

  static kMsgBits() {
    return 0b11 << 6;
  }

  static getMultipartBits(headerByte) {
    return (headerByte >> 6) & 0xff;
  }

  static getHeaderByte(multipart, size) {
    return ((multipart << 6) | (size & ~BleMessageProtocol.kMsgBits())) & 0xff;
  }

  static getSize(headerByte) {
    return headerByte & ~BleMessageProtocol.kMsgBits();
  }
}

module.exports = { BleMessageProtocol };
