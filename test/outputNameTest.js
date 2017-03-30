"use strict";

const
  Assert = require('chai').assert,
  OutputName = require('../src/outputName');

describe('OutputName', () => {
  describe('make', () => {
    const i = { name: 'y/hi.txt', contents: () => "12345678" }
    it("should replace [basename]", () => {
      const fn = OutputName.make("x/[basename]");
      Assert.equal(fn(i), "x/hi.txt")
    })
    it("should replace [name] & [ext]", () => {
      const fn = OutputName.make("[name]-hehe.[ext]");
      Assert.equal(fn(i), "hi-hehe.txt")
    })
    it("should replace [path]", () => {
      const fn = OutputName.make("[path]/123");
      Assert.equal(fn(i), "y/123")
    })
    it("should replace [md5]", () => {
      const fn = OutputName.make("[md5].[ext]");
      Assert.equal(fn(i), "25d55ad283aa400af464c76d713c07ad.txt")
    })
    it("should replace [sha256]", () => {
      const fn = OutputName.make("[sha256].[ext]");
      Assert.equal(fn(i), "ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f.txt")
    })
    it("should replace [sha256:16]", () => {
      const fn = OutputName.make("[sha256:16].[ext]");
      Assert.equal(fn(i), "ef797c8118f02dfb.txt")
    })
    it("should replace [hash]", () => {
      const fn = OutputName.make("[hash].[ext]");
      Assert.equal(fn(i), "ef797c8118f02dfb649607dd5d3f8c76.txt")
    })
    it("should replace [hash:16]", () => {
      const fn = OutputName.make("[hash:16].[ext]");
      Assert.equal(fn(i), "ef797c8118f02dfb.txt")
    })
  });
});
