package com.db.dbworld.controllers;


import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.payloads.user.UserCinemaDataDto;
import com.db.dbworld.services.InformationCollectorService;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(value = "/api/event-info")
public class InformationCollectorController {

    @Autowired
    private InformationCollectorService informationCollectorService;

    @Autowired
    private ModelMapper modelMapper;

    @PostMapping(value = "/")
    private void getUserEventInfo(@RequestBody RequestPayloads.InformationCollector informationCollector){
        informationCollectorService.saveUserEventInfo(this.modelMapper.map(informationCollector, UserCinemaDataDto.class));
    }

}
